import { describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { getAddress, stringToHex, type Hex } from 'viem';
import { BASE_CHAIN_ID, MEGASTERA_SOURCE } from './config';
import { BASE_JACKPOT, type MegasteraProof } from './eligibility';
import { MemoryBackendPlanetStore } from './backendPlanet';
import { createBackendPlanetRoutes } from './backendPlanetRoutes';

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

function makeApp() {
  const store = new MemoryBackendPlanetStore();
  const config = { chainId: BASE_CHAIN_ID, rpcUrl: 'https://rpc.example.test', databaseUrl: 'postgres://example', confirmations: 6n } as const;
  const app = new Hono();
  app.route('/api', createBackendPlanetRoutes({
    loadConfig: () => config,
    findTicket: vi.fn(async () => proof),
    saveProof: vi.fn(async () => store.saveProof(proof)),
    getStore: () => store,
    allows: () => true,
  }));
  return { app, store };
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
});
