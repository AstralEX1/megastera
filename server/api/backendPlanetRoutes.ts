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
import { getBackendPlanetMiningSnapshot, getBackendWalletMiningSnapshot } from './miningStore.js';
import { findTicketFromReceipt, parseReceiptReference, type ReceiptReference } from './receiptVerification.js';
import { saveMegasteraProof } from './prismaTicketPurchase.js';

export type BackendPlanetReference = ReceiptReference;

export type BackendPlanetRouteDependencies = {
  loadConfig: () => BackendPlanetConfig;
  findTicket: (config: BackendPlanetConfig, reference: BackendPlanetReference) => Promise<MegasteraProof>;
  saveProof: (config: BackendPlanetConfig, proof: MegasteraProof) => Promise<void>;
  getStore: (config: BackendPlanetConfig) => BackendPlanetStore;
  allows: (key: string) => boolean;
  now: () => Date;
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

function serializeMining(mining: Awaited<ReturnType<typeof getBackendPlanetMiningSnapshot>>) {
  return mining
    ? {
        ...mining,
        planetId: mining.planetId,
      }
    : undefined;
}

function defaultDependencies(): BackendPlanetRouteDependencies {
  return {
    loadConfig: () => loadBackendPlanetConfig(process.env),
    findTicket: (config, reference) => findTicketFromReceipt(config, reference),
    saveProof: (config, proof) => saveMegasteraProof(getPrismaClient(config.databaseUrl), proof),
    getStore: (config) => new PrismaBackendPlanetStore(getPrismaClient(config.databaseUrl)),
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
    } catch {
      return c.json({ error: 'The backend Planet API is not configured.' }, 503);
    }
  });

  app.get('/planets/collection', async (c) => {
    const owner = c.req.query('owner');
    if (!owner || !isAddress(owner)) return c.json({ error: 'A valid owner address is required.' }, 400);
    try {
      const collection = await dependencies.getStore(dependencies.loadConfig()).listCollection(getAddress(owner));
      return c.json({ planets: collection.map(serializeCollectionRow) });
    } catch {
      return c.json({ error: 'The backend Planet collection is not configured.' }, 503);
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
      return new Response(gif.bytes, {
        status: 200,
        headers: {
          'content-type': 'image/gif',
          'content-length': String(gif.bytes.byteLength),
          etag: `"${gif.hash}"`,
          'cache-control': 'public, max-age=31536000, immutable',
          'x-content-type-options': 'nosniff',
        },
      });
    } catch {
      return c.json({ error: 'The backend Planet API is not configured.' }, 503);
    }
  });

  app.get('/planets/:planetId/mining', async (c) => {
    const rawPlanetId = c.req.param('planetId');
    if (isRetiredPlanetPath(rawPlanetId)) return c.json({ error: 'Planet not found.' }, 404);
    const parsed = planetIdSchema.safeParse(rawPlanetId);
    if (!parsed.success) return c.json({ error: 'A valid Planet ID is required.' }, 400);
    try {
      const config = dependencies.loadConfig();
      const mining = await getBackendPlanetMiningSnapshot(
        getPrismaClient(config.databaseUrl),
        parsed.data,
        dependencies.now(),
      );
      return mining ? c.json({ mining: serializeMining(mining) }) : c.json({ error: 'Mining data is not available for this Planet.' }, 404);
    } catch {
      return c.json({ error: 'The mining API is not configured.' }, 503);
    }
  });

  app.get('/wallets/:address/mining', async (c) => {
    const owner = c.req.param('address');
    if (!isAddress(owner)) return c.json({ error: 'A valid wallet address is required.' }, 400);
    try {
      const config = dependencies.loadConfig();
      const mining = await getBackendWalletMiningSnapshot(
        getPrismaClient(config.databaseUrl),
        getAddress(owner).toLowerCase(),
        dependencies.now(),
      );
      return c.json({ mining });
    } catch {
      return c.json({ error: 'The mining API is not configured.' }, 503);
    }
  });

  app.get('/planets/:planetId', async (c) => {
    const rawPlanetId = c.req.param('planetId');
    if (isRetiredPlanetPath(rawPlanetId)) return c.json({ error: 'Planet not found.' }, 404);
    const parsed = planetIdSchema.safeParse(rawPlanetId);
    if (!parsed.success) return c.json({ error: 'A valid Planet ID is required.' }, 400);
    try {
      const planet = await dependencies.getStore(dependencies.loadConfig()).getPlanet(parsed.data);
      return planet ? c.json({ planet: serializePlanet(planet) }) : c.json({ error: 'Planet not found.' }, 404);
    } catch {
      return c.json({ error: 'The backend Planet API is not configured.' }, 503);
    }
  });

  return app;
}
