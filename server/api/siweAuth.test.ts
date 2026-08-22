import { Hono } from 'hono';
import { createSiweMessage } from 'viem/siwe';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { verifyMessage, type Address, type Hex } from 'viem';
import { beforeEach, describe, expect, it } from 'vitest';
import type { PrismaClient } from './generated/prisma/client.js';
import { createSiweAuthRoutes } from './siweAuth.js';
import { BASE_CHAIN_ID } from './config.js';

const ORIGIN = 'https://megastera.example';
const NOW = new Date('2026-08-21T12:00:00.000Z');
const NONCE = 'a'.repeat(96);
const SESSION_SECRET = 's'.repeat(32);

type NonceRow = {
  nonce: string;
  walletAddress: string;
  issuedAt: Date;
  expiresAt: Date;
};

function makePrisma() {
  const rows = new Map<string, NonceRow>();
  const siweNonce = {
    create: async ({ data }: { data: NonceRow }) => {
      rows.set(data.nonce, data);
      return data;
    },
    findUnique: async ({ where }: { where: { nonce: string } }) => rows.get(where.nonce) ?? null,
    deleteMany: async ({
      where,
    }: {
      where: {
        nonce?: string;
        walletAddress?: string;
        expiresAt?: { lte?: Date; gt?: Date };
      };
    }) => {
      let count = 0;
      for (const [nonce, row] of rows) {
        if (where.nonce !== undefined && row.nonce !== where.nonce) continue;
        if (where.walletAddress !== undefined && row.walletAddress !== where.walletAddress) continue;
        if (where.expiresAt?.lte !== undefined && row.expiresAt > where.expiresAt.lte) continue;
        if (where.expiresAt?.gt !== undefined && row.expiresAt <= where.expiresAt.gt) continue;
        rows.delete(nonce);
        count += 1;
      }
      return { count };
    },
  };
  return {
    prisma: { siweNonce } as unknown as PrismaClient,
    rows,
  };
}

type Challenge = {
  address: Address;
  chainId: number;
  domain: string;
  expirationTime: string;
  issuedAt: string;
  nonce: string;
  scheme: string;
  uri: string;
  version: '1';
};

function messageFor(challenge: Challenge, overrides: Partial<{
  chainId: number;
  domain: string;
  nonce: string;
  scheme: string;
  statement: string;
  uri: string;
}> = {}) {
  return createSiweMessage({
    address: challenge.address,
    chainId: overrides.chainId ?? challenge.chainId,
    domain: overrides.domain ?? challenge.domain,
    expirationTime: new Date(challenge.expirationTime),
    issuedAt: new Date(challenge.issuedAt),
    nonce: overrides.nonce ?? challenge.nonce,
    scheme: overrides.scheme ?? challenge.scheme,
    statement: overrides.statement,
    uri: overrides.uri ?? challenge.uri,
    version: '1',
  });
}

describe('SIWE authentication routes', () => {
  let now: Date;
  let account: ReturnType<typeof privateKeyToAccount>;
  let otherAccount: ReturnType<typeof privateKeyToAccount>;
  let app: Hono;

  beforeEach(() => {
    now = new Date(NOW);
    account = privateKeyToAccount(generatePrivateKey());
    otherAccount = privateKeyToAccount(generatePrivateKey());
    const { prisma } = makePrisma();
    app = new Hono();
    app.route('/api/auth/siwe', createSiweAuthRoutes({
      generateNonce: () => NONCE,
      getPrisma: () => prisma,
      loadConfig: () => ({
        chainId: BASE_CHAIN_ID,
        confirmations: 6n,
        databaseUrl: 'postgresql://example.test/db',
        mineralUpgradesEnabled: true,
        rpcUrl: 'https://rpc.example.test',
        siweOrigin: ORIGIN,
        siweSessionSecret: SESSION_SECRET,
      }),
      now: () => now,
      verifySignature: async (_config, input) => verifyMessage({
        address: input.address,
        message: input.message,
        signature: input.signature,
      }),
    }));
  });

  async function issueChallenge(address = account.address): Promise<Challenge> {
    const response = await app.request(`${ORIGIN}/api/auth/siwe/nonce`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ORIGIN },
      body: JSON.stringify({ address }),
    });
    expect(response.status).toBe(201);
    return (await response.json()) as Challenge;
  }

  async function verify(message: string, signature: Hex) {
    return app.request(`${ORIGIN}/api/auth/siwe/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ORIGIN },
      body: JSON.stringify({ message, signature }),
    });
  }

  it('creates a valid short-lived signed session cookie', async () => {
    const challenge = await issueChallenge();
    const message = messageFor(challenge);
    const response = await verify(message, await account.signMessage({ message }));

    expect(response.status).toBe(204);
    const cookie = response.headers.get('set-cookie');
    expect(cookie).toContain('__Host-megastera-siwe=');
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('Max-Age=900');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).not.toContain('Domain=');
  });

  it('rejects a signature from a different wallet', async () => {
    const challenge = await issueChallenge();
    const message = messageFor(challenge);

    expect((await verify(message, await otherAccount.signMessage({ message }))).status).toBe(401);
  });

  it('rejects a wrong nonce and a replayed nonce', async () => {
    const challenge = await issueChallenge();
    const wrongMessage = messageFor(challenge, { nonce: 'b'.repeat(96) });
    expect((await verify(wrongMessage, await account.signMessage({ message: wrongMessage }))).status).toBe(401);

    const message = messageFor(challenge);
    const signature = await account.signMessage({ message });
    expect((await verify(message, signature)).status).toBe(204);
    expect((await verify(message, signature)).status).toBe(401);
  });

  it.each([
    ['domain', { domain: 'evil.example' }],
    ['URI', { uri: 'https://megastera.example/other' }],
    ['chain ID', { chainId: 1 }],
  ] as const)('rejects a signed message with the wrong %s', async (_label, override) => {
    const challenge = await issueChallenge();
    const message = messageFor(challenge, override);

    expect((await verify(message, await account.signMessage({ message }))).status).toBe(401);
  });

  it('reconstructs and compares the complete canonical message', async () => {
    const challenge = await issueChallenge();
    const message = messageFor(challenge, { statement: 'An extra signed statement.' });

    expect((await verify(message, await account.signMessage({ message }))).status).toBe(401);
  });

  it('rejects the wrong SIWE version', async () => {
    const challenge = await issueChallenge();
    const message = messageFor(challenge).replace('Version: 1', 'Version: 2');

    expect((await verify(message, await account.signMessage({ message }))).status).toBe(401);
  });

  it('rejects an expired challenge', async () => {
    const challenge = await issueChallenge();
    const message = messageFor(challenge);
    now = new Date(NOW.getTime() + 5 * 60_000 + 1);

    expect((await verify(message, await account.signMessage({ message }))).status).toBe(401);
  });

  it('requires the exact configured request origin', async () => {
    const response = await app.request(`${ORIGIN}/api/auth/siwe/nonce`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
      body: JSON.stringify({ address: account.address }),
    });

    expect(response.status).toBe(403);
  });
});
