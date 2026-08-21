import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  backendApiUrl,
  type BackendApiError,
  fetchBackendPlanets,
  requestBackendPlanetGeneration,
  requestBackendPlanetUpgrade,
  requestSiweChallenge,
  verifySiweLogin,
} from './backendApi';

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
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

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

    await expect(requestBackendPlanetUpgrade({
      expectedAddress: ADDRESS,
      planetId: 'planet-1',
      targetLevel: 1,
    })).resolves.toEqual({
      purchaseId: 'purchase-1',
      planetId: 'planet-1',
      ownerAddress: ADDRESS,
      targetLevel: 1,
      bonusBpsAfter: 1000,
      costMicros: '200000',
      purchasedAt: '2026-08-13T12:00:00.000Z',
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/planets/planet-1/upgrade', expect.objectContaining({
      body: JSON.stringify({ expectedAddress: ADDRESS, targetLevel: 1 }),
      credentials: 'same-origin',
      method: 'POST',
    }));
  });

  it('preserves an upgrade 401 so the caller can start SIWE once', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'Wallet authentication is required.' }), { status: 401 }),
    );

    await expect(requestBackendPlanetUpgrade({
      expectedAddress: ADDRESS,
      planetId: 'planet-1',
      targetLevel: 1,
    })).rejects.toEqual(expect.objectContaining<Partial<BackendApiError>>({
      message: 'Wallet authentication is required.',
      status: 401,
    }));
  });

  it('uses same-origin credentials for the minimal SIWE challenge and verification flow', async () => {
    const challenge = {
      address: ADDRESS,
      chainId: 8453,
      domain: 'megastera.example',
      expirationTime: '2026-08-21T12:05:00.000Z',
      issuedAt: '2026-08-21T12:00:00.000Z',
      nonce: 'a'.repeat(96),
      scheme: 'https',
      uri: 'https://megastera.example',
      version: '1',
    } as const;
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(challenge), { status: 201 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(requestSiweChallenge(ADDRESS)).resolves.toEqual(challenge);
    await expect(verifySiweLogin({ message: 'canonical message', signature: '0x12' })).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/auth/siwe/nonce', expect.objectContaining({
      body: JSON.stringify({ address: ADDRESS }),
      credentials: 'same-origin',
      method: 'POST',
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/auth/siwe/verify', expect.objectContaining({
      body: JSON.stringify({ message: 'canonical message', signature: '0x12' }),
      credentials: 'same-origin',
      method: 'POST',
    }));
  });

  it('refuses a cross-origin SIWE backend before requesting a challenge', async () => {
    vi.stubGlobal('location', new URL('https://megastera.example'));
    vi.stubEnv('VITE_BACKEND_API_BASE_URL', 'https://evil.example');
    vi.resetModules();
    const isolatedApi = await import('./backendApi');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        address: ADDRESS,
        chainId: 8453,
        domain: 'megastera.example',
        expirationTime: '2026-08-21T12:05:00.000Z',
        issuedAt: '2026-08-21T12:00:00.000Z',
        nonce: 'a'.repeat(96),
        scheme: 'https',
        uri: 'https://megastera.example',
        version: '1',
      }), { status: 201 }),
    );

    await expect(isolatedApi.requestSiweChallenge(ADDRESS)).rejects.toThrow(/same-origin/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses a SIWE challenge that is not pinned to the page origin', async () => {
    vi.stubGlobal('location', new URL('https://megastera.example'));
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        address: ADDRESS,
        chainId: 8453,
        domain: 'evil.example',
        expirationTime: '2026-08-21T12:05:00.000Z',
        issuedAt: '2026-08-21T12:00:00.000Z',
        nonce: 'a'.repeat(96),
        scheme: 'https',
        uri: 'https://evil.example',
        version: '1',
      }), { status: 201 }),
    );

    await expect(requestSiweChallenge(ADDRESS)).rejects.toThrow(/malformed/i);
  });
});
