import { afterEach, describe, expect, it, vi } from 'vitest';
import { backendApiUrl, fetchBackendPlanets, requestBackendPlanetGeneration } from './backendApi';

const ADDRESS = '0x0000000000000000000000000000000000000001' as const;
const TX = `0x${'a'.repeat(64)}` as const;
const planet = {
  planetId: 'planet-1',
  chainId: 84532,
  ticketId: '7',
  ownerAddress: ADDRESS,
  name: 'Astraea',
  seed: `0x${'1'.repeat(64)}`,
  traitsHash: `0x${'2'.repeat(64)}`,
  generatorVersion: 3,
  planetType: 'Nebula',
  terrain: 'simplex',
  rarity: 'Common',
  satelliteCount: 1,
  hasRing: false,
  baseMineralsPerDay: '24',
  generatedAt: '2026-08-13T12:00:00.000Z',
  status: 'READY',
  gifHash: `0x${'3'.repeat(64)}`,
  gifUrl: '/api/planets/planet-1/gif',
  ticket: {
    ticketId: '7',
    drawingId: '218',
    normals: [4, 11, 17, 26, 39],
    bonusBall: 6,
    originTxHash: TX,
    logIndex: '4',
  },
};

describe('backendApiUrl', () => {
  it('keeps same-origin routes relative', () => {
    expect(backendApiUrl('/api/planets', '')).toBe('/api/planets');
  });

  it('resolves routes against a separate origin', () => {
    expect(backendApiUrl('/api/leaderboard/current', 'https://api.example.test/v2')).toBe(
      'https://api.example.test/api/leaderboard/current',
    );
  });
});

describe('backend Planet API', () => {
  afterEach(() => vi.restoreAllMocks());

  it('fetches and validates backend Planet rows', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ planets: [planet] }), { status: 200 }),
    );

    const result = await fetchBackendPlanets(ADDRESS);

    expect(result[0]?.planetId).toBe('planet-1');
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/planets?owner=${ADDRESS}`,
      expect.objectContaining({ signal: undefined }),
    );
  });

  it('posts a receipt reference and fails closed on malformed responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ planet }), { status: 201 }),
    );
    const result = await requestBackendPlanetGeneration({ transactionHash: TX, logIndex: 4n, recipient: ADDRESS });
    expect(result.ticketId).toBe('7');

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ planet: { ticketId: 'broken' } }), { status: 200 }),
    );
    await expect(requestBackendPlanetGeneration({ transactionHash: TX, logIndex: 4n })).rejects.toThrow(/malformed/i);
  });

  it('exposes an immutable receipt-only Planet upgrade request', async () => {
    const module = await import('./backendApi');
    expect(module.requestBackendPlanetUpgrade).toEqual(expect.any(Function));
    if (typeof module.requestBackendPlanetUpgrade !== 'function') return;

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ upgrade: {
        purchaseId: 'purchase-1',
        planetId: 'planet-1',
        ownerAddress: ADDRESS,
        targetLevel: 1,
        bonusBpsAfter: 1000,
        costMicros: '200000',
        purchasedAt: '2026-08-13T12:00:00.000Z',
        currentBalanceMicros: '4800000',
      } }), { status: 200 }),
    );

    await expect(module.requestBackendPlanetUpgrade({ planetId: 'planet-1', targetLevel: 1 })).resolves.toEqual({
      purchaseId: 'purchase-1',
      planetId: 'planet-1',
      ownerAddress: ADDRESS,
      targetLevel: 1,
      bonusBpsAfter: 1000,
      costMicros: '200000',
      purchasedAt: '2026-08-13T12:00:00.000Z',
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/planets/planet-1/upgrade', expect.objectContaining({ method: 'POST' }));
  });
});
