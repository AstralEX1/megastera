import { describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { generateSignedCookie } from 'hono/cookie';
import { getAddress, stringToHex, type Hex } from 'viem';
import { BASE_CHAIN_ID, MEGASTERA_SOURCE } from './config.js';
import { BASE_JACKPOT, type MegasteraProof } from './eligibility.js';
import { MemoryBackendPlanetStore } from './backendPlanet.js';
import { createBackendPlanetRoutes } from './backendPlanetRoutes.js';
import { SIWE_SESSION_COOKIE } from './siweAuth.js';

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
const SIWE_ORIGIN = 'https://megastera.example';
const SIWE_SECRET = 's'.repeat(32);
const NOW = new Date('2026-08-21T00:00:00.000Z');

const upgradeConfig = {
  ...config,
  mineralEconomyCutoverAt: new Date('2026-08-20T00:00:00.000Z'),
  mineralUpgradesEnabled: true,
  siweOrigin: SIWE_ORIGIN,
  siweSessionSecret: SIWE_SECRET,
} as const;

async function sessionCookie(address = proof.recipient, issuedAt = NOW) {
  const value = [
    'v1',
    address.toLowerCase(),
    issuedAt.getTime(),
    issuedAt.getTime() + 15 * 60_000,
  ].join('.');
  return (await generateSignedCookie(SIWE_SESSION_COOKIE, value, SIWE_SECRET, {
    path: '/',
    secure: true,
  })).split(';')[0];
}

function makeUpgradeApp() {
  const purchaseUpgrade = vi.fn().mockResolvedValue({
    purchaseId: 'purchase-1',
    planetId: 'planet-1',
    ownerAddress: proof.recipient.toLowerCase(),
    targetLevel: 1,
    bonusBpsAfter: 1_000,
    costMicros: '200000',
    purchasedAt: NOW.toISOString(),
  });
  const getPrisma = vi.fn(() => ({} as never));
  const assertPulseFresh = vi.fn().mockResolvedValue(undefined);
  const app = new Hono();
  app.route('/api', createBackendPlanetRoutes({
    ...makeAppDependencies(),
    getPrisma,
    loadConfig: () => upgradeConfig,
    now: () => NOW,
    purchaseUpgrade,
    assertPulseFresh,
  }));
  return { app, assertPulseFresh, getPrisma, purchaseUpgrade };
}

function makeAppDependencies() {
  const store = new MemoryBackendPlanetStore();
  return {
    loadConfig: () => config,
    findTicket: vi.fn(async () => proof),
    saveProof: vi.fn(async () => store.saveProof(proof)),
    getStore: () => store,
    allows: () => true,
    now: () => new Date('2026-08-21T00:00:00.000Z'),
    assertPulseFresh: vi.fn().mockResolvedValue(undefined),
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

  it('checks Pulse freshness before a generation that can settle balance', async () => {
    const dependencies = makeAppDependencies();
    const app = new Hono();
    app.route('/api', createBackendPlanetRoutes(dependencies));
    const response = await app.request('/api/planets/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ transactionHash: proof.originTxHash, logIndex: Number(proof.logIndex) }),
    });

    expect(response.status).toBe(201);
    expect(dependencies.assertPulseFresh).toHaveBeenCalledOnce();
  });

  it('retires the per-Planet mining route', async () => {
    const getPrisma = vi.fn();
    const app = new Hono();
    app.route('/api', createBackendPlanetRoutes({
      ...makeAppDependencies(),
      getPrisma,
    }));

    const response = await app.request('/api/planets/planet-1/mining');

    expect(response.status).toBe(404);
    expect(getPrisma).not.toHaveBeenCalled();
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
      body: JSON.stringify({ targetLevel: 0, expectedAddress: proof.recipient }),
    });

    expect(response.status).toBe(400);
    expect(getPrisma).not.toHaveBeenCalled();
  });

  it('requires expectedAddress before touching the database', async () => {
    const { app, getPrisma } = makeUpgradeApp();

    const response = await app.request(`${SIWE_ORIGIN}/api/planets/planet-1/upgrade`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: SIWE_ORIGIN },
      body: JSON.stringify({ targetLevel: 1 }),
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
      body: JSON.stringify({ targetLevel: 1, expectedAddress: proof.recipient }),
    });

    expect(response.status).toBe(404);
    expect(getPrisma).not.toHaveBeenCalled();
  });

  it('rejects an unauthenticated upgrade when the kill switch is enabled', async () => {
    const { app, getPrisma } = makeUpgradeApp();

    const response = await app.request(`${SIWE_ORIGIN}/api/planets/planet-1/upgrade`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: SIWE_ORIGIN },
      body: JSON.stringify({ targetLevel: 1, expectedAddress: proof.recipient }),
    });

    expect(response.status).toBe(401);
    expect(getPrisma).not.toHaveBeenCalled();
  });

  it('rejects an expired session and a session for another connected wallet', async () => {
    const { app, getPrisma } = makeUpgradeApp();
    const expired = await sessionCookie(proof.recipient, new Date(NOW.getTime() - 16 * 60_000));
    const wrongWallet = await sessionCookie('0x2222222222222222222222222222222222222222');
    const request = (cookie: string) => app.request(`${SIWE_ORIGIN}/api/planets/planet-1/upgrade`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie, origin: SIWE_ORIGIN },
      body: JSON.stringify({ targetLevel: 1, expectedAddress: proof.recipient }),
    });

    expect((await request(expired)).status).toBe(401);
    expect((await request(wrongWallet)).status).toBe(401);
    expect(getPrisma).not.toHaveBeenCalled();
  });

  it('returns 403 when the locked Planet belongs to another wallet', async () => {
    const { app, purchaseUpgrade } = makeUpgradeApp();
    purchaseUpgrade.mockRejectedValue(new Error('Authenticated wallet does not own this Planet.'));

    const response = await app.request(`${SIWE_ORIGIN}/api/planets/planet-1/upgrade`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: await sessionCookie(),
        origin: SIWE_ORIGIN,
      },
      body: JSON.stringify({ targetLevel: 1, expectedAddress: proof.recipient }),
    });

    expect(response.status).toBe(403);
  });

  it('passes only the authenticated session wallet into an owner upgrade', async () => {
    const { app, assertPulseFresh, purchaseUpgrade } = makeUpgradeApp();

    const response = await app.request(`${SIWE_ORIGIN}/api/planets/planet-1/upgrade`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: await sessionCookie(),
        origin: SIWE_ORIGIN,
      },
      body: JSON.stringify({ targetLevel: 1, expectedAddress: proof.recipient }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ upgrade: { purchaseId: 'purchase-1' } });
    expect(assertPulseFresh).toHaveBeenCalledOnce();
    expect(purchaseUpgrade).toHaveBeenCalledWith(expect.anything(), {
      authenticatedWalletAddress: proof.recipient.toLowerCase(),
      cutoverAt: upgradeConfig.mineralEconomyCutoverAt,
      planetId: 'planet-1',
      targetLevel: 1,
    });
  });
});
