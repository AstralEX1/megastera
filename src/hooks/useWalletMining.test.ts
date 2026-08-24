import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchWalletMining, MINING_REFRESH_INTERVAL_MS, walletMiningQueryOptions } from './useWalletMining';

const ADDRESS = '0x1111111111111111111111111111111111111111' as const;

afterEach(() => vi.unstubAllGlobals());

describe('wallet mining refresh', () => {
  it('refetches the dynamic mining snapshot every 60 seconds', () => {
    expect(MINING_REFRESH_INTERVAL_MS).toBe(60_000);
    expect(walletMiningQueryOptions(ADDRESS).refetchInterval).toBe(60_000);
    expect(walletMiningQueryOptions(ADDRESS).staleTime).toBe(60_000);
  });

  it('parses the V2 spendable balance and per-Planet upgrade contract', async () => {
    const payload = {
      mining: {
        ownerAddress: ADDRESS,
        asOf: '2026-08-13T12:00:00.000Z',
        ownedPlanetCount: 1,
        currentBalanceMicros: '5000000',
        effectiveMineralsPerDayMicros: '86400000000',
        upgradesEnabled: true,
        galaxyPulse: {
          drawingId: '150',
          settledAt: '2026-08-21T17:00:11.000Z',
          slots: [
            { planetType: 'gaia', modifierBps: 5_000 },
            { planetType: 'nebula', modifierBps: -2_000 },
            { planetType: 'gaia', modifierBps: 1_000 },
            { planetType: 'void', modifierBps: 0 },
          ],
        },
        achievements: [
          { id: 'galactic-cartographer', current: 3, tiers: [3, 5, 10] },
          { id: 'mineral-tycoon', current: 500, tiers: [500, 2_500, 25_000] },
        ],
        planets: [{
          planetId: 'planet-1',
          planetType: 'Nebula',
          sameTypeCount: 3,
          collectionBonusBps: 500,
          baseMineralsPerDay: '24',
          effectiveMineralsPerDayMicros: '25200000',
          upgradeLevel: 1,
          upgradeBonusBps: 1000,
          galaxyPulseBps: -2_000,
          nextUpgrade: { targetLevel: 2, bonusBpsAfter: 2500, costMicros: '300000' },
        }],
      },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 })));

    await expect(fetchWalletMining(ADDRESS)).resolves.toEqual(payload.mining);
  });

  it('rejects a snapshot without the authoritative current balance', async () => {
    const payload = {
      mining: {
        ownerAddress: ADDRESS,
        asOf: '2026-08-13T12:00:00.000Z',
        ownedPlanetCount: 0,
        effectiveMineralsPerDayMicros: '0',
        upgradesEnabled: false,
        achievements: [],
        planets: [],
      },
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 })));

    await expect(fetchWalletMining(ADDRESS)).rejects.toThrow(/currentBalanceMicros/i);
  });
});
