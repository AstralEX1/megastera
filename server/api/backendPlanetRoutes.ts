import { Hono } from 'hono';
import { getAddress, isAddress } from 'viem';
import { z } from 'zod';
import { getPrismaClient } from './database.js';
import { loadBackendPlanetConfig, type BackendPlanetConfig } from './backendConfig.js';
import {
  type BackendPlanetCollectionRecord,
  type BackendPlanetRecord,
  type BackendPlanetStore,
  PrismaBackendPlanetStore,
} from './backendPlanet.js';
import type { MegasteraProof } from './eligibility.js';
import { readBoundedJson } from './http.js';
import { getBackendWalletMiningSnapshot } from './miningStore.js';
import { findTicketFromReceipt, parseReceiptReference, type ReceiptReference } from './receiptVerification.js';
import { saveMegasteraProof } from './prismaTicketPurchase.js';
import { reportBackendError } from './errorDiagnostics.js';
import type { PrismaClient } from './generated/prisma/client.js';

export type BackendPlanetReference = ReceiptReference;

export type BackendPlanetRouteDependencies = {
  loadConfig: () => BackendPlanetConfig;
  findTicket: (config: BackendPlanetConfig, reference: BackendPlanetReference) => Promise<MegasteraProof>;
  saveProof: (config: BackendPlanetConfig, proof: MegasteraProof) => Promise<void>;
  getStore: (config: BackendPlanetConfig) => BackendPlanetStore;
  allows: (key: string) => boolean;
  now: () => Date;
  getPrisma?: (config: BackendPlanetConfig) => PrismaClient;
};

const MAX_BATCH = 50;
const planetIdSchema = z.string().min(1).max(128).regex(/^[A-Za-z0-9-]+$/);
const RETIRED_PLANET_PATHS = new Set(['generate', 'vouchers', 'readiness', 'health', 'metrics']);

function isRetiredPlanetPath(value: string): boolean {
  return RETIRED_PLANET_PATHS.has(value.toLowerCase());
}

function serializePlanet(planet: BackendPlanetRecord) {
  return {
    ...planet,
    gifUrl: `/api/planets/${planet.planetId}/gif`,
  };
}

function serializeCollectionRow(row: BackendPlanetCollectionRecord) {
  return {
    generationStatus: row.generationStatus,
    ticket: row.ticket,
    planet: row.planet ? serializePlanet(row.planet) : null,
    generationError: row.generationError ?? null,
  };
}

function defaultDependencies(): BackendPlanetRouteDependencies {
  return {
    loadConfig: () => loadBackendPlanetConfig(process.env),
    findTicket: (config, reference) => findTicketFromReceipt(config, reference),
    saveProof: (config, proof) => saveMegasteraProof(getPrismaClient(config.databaseUrl), proof),
    getStore: (config) =>
      new PrismaBackendPlanetStore(
        getPrismaClient(config.databaseUrl),
        () => new Date(),
        config.mineralEconomyCutoverAt ?? null,
      ),
    getPrisma: (config) => getPrismaClient(config.databaseUrl),
    allows: createRateLimiter(),
    now: () => new Date(),
  };
}

export function createRateLimiter(limit = 120, windowMs = 60_000, now = () => Date.now()) {
  const counts = new Map<string, { count: number; resetsAt: number }>();
  return (key: string) => {
    const timestamp = now();
    const current = counts.get(key);
    if (!current || current.resetsAt <= timestamp) {
      counts.set(key, { count: 1, resetsAt: timestamp + windowMs });
      return true;
    }
    if (current.count >= limit) return false;
    current.count += 1;
    return true;
  };
}

export function createBackendPlanetRoutes(
  overrides: Partial<BackendPlanetRouteDependencies> = {},
) {
  const dependencies = { ...defaultDependencies(), ...overrides };
  const app = new Hono();
  const inFlight = new Map<string, Promise<BackendPlanetRecord>>();

  const generate = async (reference: BackendPlanetReference) => {
    const key = `${reference.transactionHash.toLowerCase()}:${reference.logIndex}`;
    const current = inFlight.get(key);
    if (current) return current;
    const operation = (async () => {
      const config = dependencies.loadConfig();
      if (!dependencies.allows(key)) throw new Error('Planet generation is rate limited.');
      const proof = await dependencies.findTicket(config, reference);
      await dependencies.saveProof(config, proof);
      return dependencies.getStore(config).generatePlanet(proof);
    })();
    inFlight.set(key, operation);
    void operation.finally(() => inFlight.delete(key)).catch(() => undefined);
    return operation;
  };

  app.post('/planets/generate/batch', async (c) => {
    let body: unknown;
    try {
      body = await readBoundedJson(c.req.raw);
    } catch {
      return c.json({ error: 'Request body is invalid or too large.' }, 400);
    }
    const references =
      body && typeof body === 'object' && Array.isArray((body as { references?: unknown }).references)
        ? (body as { references: unknown[] }).references
        : undefined;
    if (!references || references.length < 1 || references.length > MAX_BATCH)
      return c.json({ error: `references must contain between 1 and ${MAX_BATCH} items.` }, 400);
    const planets: unknown[] = [];
    for (const value of references) {
      const reference = parseReceiptReference(value);
      if (!reference) return c.json({ error: 'Every reference must contain a valid transactionHash and logIndex.' }, 400);
      try {
        planets.push(serializePlanet(await generate(reference)));
      } catch {
        return c.json({ error: 'Planet generation failed.' }, 422);
      }
    }
    return c.json({ planets }, 201);
  });

  app.post('/planets/generate', async (c) => {
    let body: unknown;
    try {
      body = await readBoundedJson(c.req.raw);
    } catch {
      return c.json({ error: 'Request body is invalid or too large.' }, 400);
    }
    const reference = parseReceiptReference(body);
    if (!reference) return c.json({ error: 'transactionHash and logIndex are required.' }, 400);
    try {
      return c.json({ planet: serializePlanet(await generate(reference)) }, 201);
    } catch (error) {
      if (error instanceof Error && error.message.includes('rate limited')) return c.json({ error: error.message }, 429);
      return c.json({ error: 'Planet generation failed.' }, 422);
    }
  });

  app.get('/planets', async (c) => {
    const owner = c.req.query('owner');
    if (!owner || !isAddress(owner)) return c.json({ error: 'A valid owner address is required.' }, 400);
    try {
      const planets = await dependencies.getStore(dependencies.loadConfig()).listPlanets(getAddress(owner));
      return c.json({ planets: planets.map(serializePlanet) });
    } catch (error) {
      return c.json(
        { error: 'The backend Planet API is not configured.' },
        503,
        reportBackendError('GET /api/planets', error),
      );
    }
  });

  app.get('/planets/collection', async (c) => {
    const owner = c.req.query('owner');
    if (!owner || !isAddress(owner)) return c.json({ error: 'A valid owner address is required.' }, 400);
    try {
      const collection = await dependencies.getStore(dependencies.loadConfig()).listCollection(getAddress(owner));
      return c.json({ planets: collection.map(serializeCollectionRow) });
    } catch (error) {
      return c.json(
        { error: 'The backend Planet collection is not configured.' },
        503,
        reportBackendError('GET /api/planets/collection', error),
      );
    }
  });

  app.get('/planets/:planetId/gif', async (c) => {
    const rawPlanetId = c.req.param('planetId');
    if (isRetiredPlanetPath(rawPlanetId)) return c.json({ error: 'Planet not found.' }, 404);
    const parsed = planetIdSchema.safeParse(rawPlanetId);
    if (!parsed.success) return c.json({ error: 'A valid Planet ID is required.' }, 400);
    try {
      const gif = await dependencies.getStore(dependencies.loadConfig()).getGif(parsed.data);
      if (!gif) return c.json({ error: 'Planet GIF not found.' }, 404);
      const responseBody = new ArrayBuffer(gif.bytes.byteLength);
      new Uint8Array(responseBody).set(gif.bytes);
      return new Response(responseBody, {
        status: 200,
        headers: {
          'content-type': 'image/gif',
          'content-length': String(gif.bytes.byteLength),
          etag: `"${gif.hash}"`,
          'cache-control': 'public, max-age=31536000, immutable',
          'x-content-type-options': 'nosniff',
        },
      });
    } catch (error) {
      return c.json(
        { error: 'The backend Planet API is not configured.' },
        503,
        reportBackendError('GET /api/planets/:planetId/gif', error),
      );
    }
  });

  app.get('/wallets/:address/mining', async (c) => {
    const owner = c.req.param('address');
    if (!isAddress(owner)) return c.json({ error: 'A valid wallet address is required.' }, 400);
    try {
      const config = dependencies.loadConfig();
      const mining = await getBackendWalletMiningSnapshot(
        (dependencies.getPrisma ?? ((value) => getPrismaClient(value.databaseUrl)))(config),
        getAddress(owner).toLowerCase(),
        dependencies.now(),
        {
          mineralEconomyCutoverAt: config.mineralEconomyCutoverAt,
          mineralUpgradesEnabled: config.mineralUpgradesEnabled,
        },
      );
      return c.json({ mining });
    } catch (error) {
      return c.json(
        { error: 'The mining API is not configured.' },
        503,
        reportBackendError('GET /api/wallets/:address/mining', error),
      );
    }
  });

  app.post('/planets/:planetId/upgrade', async (c) => {
    const rawPlanetId = c.req.param('planetId');
    if (isRetiredPlanetPath(rawPlanetId)) return c.json({ error: 'Planet not found.' }, 404);
    const parsedPlanetId = planetIdSchema.safeParse(rawPlanetId);
    if (!parsedPlanetId.success) return c.json({ error: 'A valid Planet ID is required.' }, 400);
    let body: unknown;
    try {
      body = await readBoundedJson(c.req.raw);
    } catch {
      return c.json({ error: 'Request body is invalid or too large.' }, 400);
    }
    const targetLevel = body && typeof body === 'object' ? (body as { targetLevel?: unknown }).targetLevel : undefined;
    if (typeof targetLevel !== 'number' || !Number.isInteger(targetLevel) || targetLevel < 1 || targetLevel > 3) {
      return c.json({ error: 'targetLevel must be an integer between 1 and 3.' }, 400);
    }
    // ponytail: public upgrades stay off until requests are authenticated to the Planet owner.
    return c.json({ error: 'Planet upgrades are disabled.' }, 404);
  });

  app.get('/planets/:planetId', async (c) => {
    const rawPlanetId = c.req.param('planetId');
    if (isRetiredPlanetPath(rawPlanetId)) return c.json({ error: 'Planet not found.' }, 404);
    const parsed = planetIdSchema.safeParse(rawPlanetId);
    if (!parsed.success) return c.json({ error: 'A valid Planet ID is required.' }, 400);
    try {
      const planet = await dependencies.getStore(dependencies.loadConfig()).getPlanet(parsed.data);
      return planet ? c.json({ planet: serializePlanet(planet) }) : c.json({ error: 'Planet not found.' }, 404);
    } catch (error) {
      return c.json(
        { error: 'The backend Planet API is not configured.' },
        503,
        reportBackendError('GET /api/planets/:planetId', error),
      );
    }
  });

  return app;
}
