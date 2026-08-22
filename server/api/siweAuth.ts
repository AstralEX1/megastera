import { Hono, type Context } from 'hono';
import { getSignedCookie, setSignedCookie } from 'hono/cookie';
import {
  createPublicClient,
  getAddress,
  http,
  isAddress,
  isHex,
  type Address,
  type Hex,
} from 'viem';
import { base } from 'viem/chains';
import {
  createSiweMessage,
  generateSiweNonce,
  parseSiweMessage,
  validateSiweMessage,
} from 'viem/siwe';
import { loadBackendPlanetConfig, type BackendPlanetConfig } from './backendConfig.js';
import { BASE_CHAIN_ID } from './config.js';
import { getPrismaClient } from './database.js';
import type { PrismaClient } from './generated/prisma/client.js';
import { readBoundedJson } from './http.js';
import { readWithRpcFallback } from './rpc.js';

const NONCE_TTL_MS = 5 * 60_000;
const SESSION_TTL_MS = 15 * 60_000;
export const SIWE_SESSION_COOKIE = '__Host-megastera-siwe';

type SignatureInput = {
  address: Address;
  domain: string;
  message: string;
  nonce: string;
  scheme: string;
  signature: Hex;
  time: Date;
};

export type SiweAuthDependencies = {
  generateNonce: () => string;
  getPrisma: (config: BackendPlanetConfig) => PrismaClient;
  loadConfig: () => BackendPlanetConfig;
  now: () => Date;
  verifySignature: (config: BackendPlanetConfig, input: SignatureInput) => Promise<boolean>;
};

type RequiredSiweConfig = {
  origin: string;
  secret: string;
};

type SiweNonceRow = {
  nonce: string;
  walletAddress: string;
  issuedAt: Date;
  expiresAt: Date;
};

function requireSiweConfig(config: BackendPlanetConfig): RequiredSiweConfig {
  const origin = config.siweOrigin;
  const secret = config.siweSessionSecret;
  if (!origin || !secret) throw new Error('SIWE is not configured.');
  const parsed = new URL(origin);
  if (parsed.protocol !== 'https:' || parsed.origin !== origin) {
    throw new Error('SIWE origin is invalid.');
  }
  if (new TextEncoder().encode(secret).byteLength < 32) {
    throw new Error('SIWE session secret is invalid.');
  }
  return { origin, secret };
}

export function isExactSiweRequestOrigin(c: Context, configuredOrigin: string): boolean {
  return c.req.header('origin') === configuredOrigin && new URL(c.req.url).origin === configuredOrigin;
}

function challengeFromRow(row: SiweNonceRow, origin: string) {
  const parsedOrigin = new URL(origin);
  return {
    address: getAddress(row.walletAddress),
    chainId: BASE_CHAIN_ID,
    domain: parsedOrigin.host,
    expirationTime: row.expiresAt.toISOString(),
    issuedAt: row.issuedAt.toISOString(),
    nonce: row.nonce,
    scheme: parsedOrigin.protocol.slice(0, -1),
    uri: parsedOrigin.origin,
    version: '1' as const,
  };
}

function canonicalMessage(challenge: ReturnType<typeof challengeFromRow>): string {
  return createSiweMessage({
    address: challenge.address,
    chainId: challenge.chainId,
    domain: challenge.domain,
    expirationTime: new Date(challenge.expirationTime),
    issuedAt: new Date(challenge.issuedAt),
    nonce: challenge.nonce,
    scheme: challenge.scheme,
    uri: challenge.uri,
    version: challenge.version,
  });
}

function isCanonicalParsedMessage(
  parsed: ReturnType<typeof parseSiweMessage>,
  challenge: ReturnType<typeof challengeFromRow>,
): boolean {
  return (
    typeof parsed.address === 'string' &&
    isAddress(parsed.address) &&
    parsed.address.toLowerCase() === challenge.address.toLowerCase() &&
    parsed.chainId === challenge.chainId &&
    parsed.domain === challenge.domain &&
    parsed.expirationTime?.getTime() === new Date(challenge.expirationTime).getTime() &&
    parsed.issuedAt?.getTime() === new Date(challenge.issuedAt).getTime() &&
    parsed.nonce === challenge.nonce &&
    parsed.scheme === challenge.scheme &&
    parsed.uri === challenge.uri &&
    parsed.version === challenge.version
  );
}

async function verifyWithBaseRpc(config: BackendPlanetConfig, input: SignatureInput): Promise<boolean> {
  const endpoints = [...new Set([config.rpcUrl, ...(config.rpcFallbackUrls ?? [])])].slice(0, 3);
  return readWithRpcFallback(endpoints, async (rpcUrl) => {
    const client = createPublicClient({ chain: base, transport: http(rpcUrl) });
    if (await client.getChainId() !== BASE_CHAIN_ID) throw new Error('SIWE RPC is not Base mainnet.');
    return client.verifySiweMessage(input);
  });
}

function defaultDependencies(): SiweAuthDependencies {
  return {
    generateNonce: generateSiweNonce,
    getPrisma: (config) => getPrismaClient(config.databaseUrl),
    loadConfig: () => loadBackendPlanetConfig(process.env),
    now: () => new Date(),
    verifySignature: verifyWithBaseRpc,
  };
}

function sessionValue(address: Address, issuedAt: Date): string {
  return [
    'v1',
    address.toLowerCase(),
    issuedAt.getTime().toString(),
    (issuedAt.getTime() + SESSION_TTL_MS).toString(),
  ].join('.');
}

export async function getSiweSessionAddress(
  c: Context,
  config: BackendPlanetConfig,
  now: Date,
): Promise<Address | undefined> {
  const { secret } = requireSiweConfig(config);
  const value = await getSignedCookie(c, secret, SIWE_SESSION_COOKIE);
  if (!value) return undefined;
  const [version, rawAddress, rawIssuedAt, rawExpiresAt, extra] = value.split('.');
  if (version !== 'v1' || extra !== undefined || !rawAddress || !isAddress(rawAddress)) return undefined;
  const issuedAt = Number(rawIssuedAt);
  const expiresAt = Number(rawExpiresAt);
  if (
    !Number.isSafeInteger(issuedAt) ||
    !Number.isSafeInteger(expiresAt) ||
    expiresAt - issuedAt !== SESSION_TTL_MS ||
    issuedAt > now.getTime() ||
    expiresAt <= now.getTime()
  ) return undefined;
  return getAddress(rawAddress).toLowerCase() as Address;
}

export function createSiweAuthRoutes(
  overrides: Partial<SiweAuthDependencies> = {},
) {
  const dependencies = { ...defaultDependencies(), ...overrides };
  const app = new Hono();

  app.post('/nonce', async (c) => {
    let config: BackendPlanetConfig;
    let siwe: RequiredSiweConfig;
    try {
      config = dependencies.loadConfig();
      if (!config.mineralUpgradesEnabled) return c.json({ error: 'Planet upgrades are disabled.' }, 404);
      siwe = requireSiweConfig(config);
    } catch {
      return c.json({ error: 'SIWE authentication is not configured.' }, 503);
    }
    if (!isExactSiweRequestOrigin(c, siwe.origin)) {
      return c.json({ error: 'Request origin is not allowed.' }, 403);
    }
    let body: unknown;
    try {
      body = await readBoundedJson(c.req.raw);
    } catch {
      return c.json({ error: 'Request body is invalid or too large.' }, 400);
    }
    const address = body && typeof body === 'object' ? (body as { address?: unknown }).address : undefined;
    if (typeof address !== 'string' || !isAddress(address)) {
      return c.json({ error: 'A valid wallet address is required.' }, 400);
    }
    try {
      const issuedAt = dependencies.now();
      const nonce = dependencies.generateNonce();
      if (!Number.isFinite(issuedAt.getTime()) || !/^[A-Za-z0-9]{8,96}$/.test(nonce)) {
        throw new Error('Invalid SIWE challenge state.');
      }
      const row = {
        nonce,
        walletAddress: getAddress(address).toLowerCase(),
        issuedAt,
        expiresAt: new Date(issuedAt.getTime() + NONCE_TTL_MS),
      };
      const prisma = dependencies.getPrisma(config);
      await prisma.siweNonce.deleteMany({ where: { expiresAt: { lte: issuedAt } } });
      await prisma.siweNonce.create({ data: row });
      c.header('cache-control', 'no-store');
      return c.json(challengeFromRow(row, siwe.origin), 201);
    } catch {
      return c.json({ error: 'SIWE challenge could not be created.' }, 503);
    }
  });

  app.post('/verify', async (c) => {
    let config: BackendPlanetConfig;
    let siwe: RequiredSiweConfig;
    try {
      config = dependencies.loadConfig();
      if (!config.mineralUpgradesEnabled) return c.json({ error: 'Planet upgrades are disabled.' }, 404);
      siwe = requireSiweConfig(config);
    } catch {
      return c.json({ error: 'SIWE authentication is not configured.' }, 503);
    }
    if (!isExactSiweRequestOrigin(c, siwe.origin)) {
      return c.json({ error: 'Request origin is not allowed.' }, 403);
    }
    let body: unknown;
    try {
      body = await readBoundedJson(c.req.raw);
    } catch {
      return c.json({ error: 'Request body is invalid or too large.' }, 400);
    }
    const candidate = body && typeof body === 'object' ? body as Record<string, unknown> : undefined;
    if (
      typeof candidate?.message !== 'string' ||
      candidate.message.length > 4_096 ||
      typeof candidate.signature !== 'string' ||
      !isHex(candidate.signature)
    ) return c.json({ error: 'A valid SIWE message and signature are required.' }, 400);

    let parsed: ReturnType<typeof parseSiweMessage>;
    try {
      parsed = parseSiweMessage(candidate.message);
    } catch {
      return c.json({ error: 'SIWE authentication failed.' }, 401);
    }
    if (typeof parsed.nonce !== 'string') return c.json({ error: 'SIWE authentication failed.' }, 401);

    const now = dependencies.now();
    let row: SiweNonceRow | null;
    try {
      row = await dependencies.getPrisma(config).siweNonce.findUnique({ where: { nonce: parsed.nonce } });
    } catch {
      return c.json({ error: 'SIWE authentication is unavailable.' }, 503);
    }
    if (!row || row.issuedAt > now || row.expiresAt <= now) {
      return c.json({ error: 'SIWE authentication failed.' }, 401);
    }

    const challenge = challengeFromRow(row, siwe.origin);
    if (
      candidate.message !== canonicalMessage(challenge) ||
      !isCanonicalParsedMessage(parsed, challenge) ||
      !validateSiweMessage({
        address: challenge.address,
        domain: challenge.domain,
        message: parsed,
        nonce: challenge.nonce,
        scheme: challenge.scheme,
        time: now,
      })
    ) return c.json({ error: 'SIWE authentication failed.' }, 401);

    let validSignature: boolean;
    try {
      validSignature = await dependencies.verifySignature(config, {
        address: challenge.address,
        domain: challenge.domain,
        message: candidate.message,
        nonce: challenge.nonce,
        scheme: challenge.scheme,
        signature: candidate.signature,
        time: now,
      });
    } catch {
      return c.json({ error: 'SIWE authentication is unavailable.' }, 503);
    }
    if (!validSignature) return c.json({ error: 'SIWE authentication failed.' }, 401);

    try {
      const consumed = await dependencies.getPrisma(config).siweNonce.deleteMany({
        where: {
          nonce: row.nonce,
          walletAddress: row.walletAddress,
          expiresAt: { gt: now },
        },
      });
      if (consumed.count !== 1) return c.json({ error: 'SIWE authentication failed.' }, 401);
      await setSignedCookie(
        c,
        SIWE_SESSION_COOKIE,
        sessionValue(challenge.address, now),
        siwe.secret,
        {
          httpOnly: true,
          maxAge: SESSION_TTL_MS / 1_000,
          path: '/',
          sameSite: 'Strict',
          secure: true,
        },
      );
      c.header('cache-control', 'no-store');
      return c.body(null, 204);
    } catch {
      return c.json({ error: 'SIWE authentication is unavailable.' }, 503);
    }
  });

  return app;
}
