import { describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { getAddress, stringToHex, type Hex } from 'viem';
import { BASE_CHAIN_ID, MEGASTERA_SOURCE } from './config.js';
import { BASE_JACKPOT, type MegasteraProof } from './eligibility.js';
import { MemoryBackendPlanetStore } from './backendPlanet.js';
import { createBackendPlanetRoutes } from './backendPlanetRoutes.js';

const proof: MegasteraProof = {
  recipient: getAddress('0x1111111111111111111111111111111111111111'),
  ticketId: 456n,
  drawingId: 12n,
  normals: [3, 17, 42, 88, 201],
  bonusBall: 9,
  originTxHash: `0x${'ab'.repeat(32)}` as Hex,
  blockNumber: 30_000_000n,
  logIndex: 4n,
  blockHash: `0x${'cd'.repeat(32)}` as Hex,
  purchasedAt: new Date('2026-08-13T12:00:00.000Z'),
  chainId: BASE_CHAIN_ID,
  jackpotAddress: BASE_JACKPOT,
  source: stringToHex(MEGASTERA_SOURCE, { size: 32 }),
};

const config = { chainId: BASE_CHAIN_ID, rpcUrl: 'https://rpc.example.test', databaseUrl: 'postgres://example', confirmations: 6n } as const;

function makeAppDependencies() {
  const store = new MemoryBackendPlanetStore();
  return {
    loadConfig: () => config,
    findTicket: vi.fn(async () => proof),
    saveProof: vi.fn(async () => store.saveProof(proof)),
    getStore: () => store,
    allows: () => true,
    now: () => new Date('2026-08-21T00:00:00.000Z'),
  };
}

function makeApp() {
  const dependencies = makeAppDependencies();
  const app = new Hono();
  app.route('/api', createBackendPlanetRoutes(dependencies));
  return { app, store: dependencies.getStore() };
}

describe('backend Planet routes', () => {
  it('rejects malformed generation references', async () => {
    const { app } = makeApp();
    const response = await app.request('/api/planets/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ transactionHash: '0x1234', logIndex: -1 }),
    });
    expect(response.status).toBe(400);
  });

  it('generates idempotently and serves owner-scoped planets and GIF bytes', async () => {
    const { app } = makeApp();
    const body = { transactionHash: proof.originTxHash, logIndex: Number(proof.logIndex) };
    const first = await app.request('/api/planets/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const second = await app.request('/api/planets/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    const firstPlanet = ((await first.json()) as { planet: { planetId: string; gifUrl: string } }).planet;
    const secondPlanet = ((await second.json()) as { planet: { planetId: string } }).planet;
    expect(secondPlanet.planetId).toBe(firstPlanet.planetId);

    const list = await app.request(`/api/planets?owner=${proof.recipient}`);
    expect(list.status).toBe(200);
    expect(((await list.json()) as { planets: unknown[] }).planets).toHaveLength(1);

    const gif = await app.request(`/api/planets/${firstPlanet.planetId}/gif`);
    expect(gif.status).toBe(200);
    expect(gif.headers.get('content-type')).toBe('image/gif');
    expect((await gif.arrayBuffer()).byteLength).toBeGreaterThan(6);
  });

  it('validates upgrade payloads before touching the database', async () => {
    const getPrisma = vi.fn();
    const app = new Hono();
    app.route('/api', createBackendPlanetRoutes({
      ...makeAppDependencies(),
      getPrisma,
    }));

    const response = await app.request('/api/planets/planet-1/upgrade', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targetLevel: 0 }),
    });

    expect(response.status).toBe(400);
    expect(getPrisma).not.toHaveBeenCalled();
  });

  it('keeps upgrades disabled before the kill switch reaches the route', async () => {
    const getPrisma = vi.fn();
    const app = new Hono();
    app.route('/api', createBackendPlanetRoutes({
      ...makeAppDependencies(),
      getPrisma,
      loadConfig: () => ({
        ...config,
        mineralEconomyCutoverAt: new Date('2026-08-20T00:00:00.000Z'),
        mineralUpgradesEnabled: false,
      }),
      now: () => new Date('2026-08-21T00:00:00.000Z'),
    }));

    const response = await app.request('/api/planets/planet-1/upgrade', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targetLevel: 1 }),
    });

    expect(response.status).toBe(404);
    expect(getPrisma).not.toHaveBeenCalled();
  });

  it('keeps upgrades unavailable before the configured cutover timestamp', async () => {
    const getPrisma = vi.fn();
    const app = new Hono();
    app.route('/api', createBackendPlanetRoutes({
      ...makeAppDependencies(),
      getPrisma,
      loadConfig: () => ({
        ...config,
        mineralEconomyCutoverAt: new Date('2026-08-22T00:00:00.000Z'),
        mineralUpgradesEnabled: true,
      }),
      now: () => new Date('2026-08-21T00:00:00.000Z'),
    }));

    const response = await app.request('/api/planets/planet-1/upgrade', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targetLevel: 1 }),
    });

    expect(response.status).toBe(404);
    expect(getPrisma).not.toHaveBeenCalled();
  });
});
