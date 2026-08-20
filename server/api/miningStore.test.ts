import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from './generated/prisma/client.js';
import { getBackendPlanetMiningSnapshot, getBackendWalletMiningSnapshot } from './miningStore.js';

describe('backend Planet mining snapshots', () => {
  it('calculates lifetime production from backend-generatedAt', async () => {
    const prisma = {
      backendPlanet: {
        findMany: async () => [
          { id: 'planet-1', ownerAddress: '0x0000000000000000000000000000000000000001', planetType: 'Nebula', baseMineralsPerDay: 86_400n, generatedAt: new Date('2026-08-10T00:00:00.000Z') },
          { id: 'planet-2', ownerAddress: '0x0000000000000000000000000000000000000001', planetType: 'Nebula', baseMineralsPerDay: 172_800n, generatedAt: new Date('2026-08-09T00:00:00.000Z') },
        ],
      },
    } as unknown as PrismaClient;
    const snapshot = await getBackendWalletMiningSnapshot(prisma, '0x0000000000000000000000000000000000000001', new Date('2026-08-10T00:00:01.000Z'));
    expect(snapshot.ownedPlanetCount).toBe(2);
    expect(snapshot.earnedMicros).toBe('172803000000');
    expect(snapshot).toMatchObject({ currentBalanceMicros: '172803000000', upgradesEnabled: false });
    expect(snapshot.planets[0]?.planetId).toBe('planet-1');
    expect(snapshot.planets[0]).toMatchObject({ planetType: 'Nebula', sameTypeCount: 2, collectionBonusBps: 0 });
  });

  it('applies the same-type bonus to every matching Planet in a wallet snapshot', async () => {
    const prisma = {
      backendPlanet: {
        findMany: async () => [
          { id: 'planet-1', ownerAddress: '0x0000000000000000000000000000000000000001', planetType: 'Nebula', baseMineralsPerDay: 100n, generatedAt: new Date('2026-08-01T00:00:00.000Z') },
          { id: 'planet-2', ownerAddress: '0x0000000000000000000000000000000000000001', planetType: 'Nebula', baseMineralsPerDay: 100n, generatedAt: new Date('2026-08-02T00:00:00.000Z') },
          { id: 'planet-3', ownerAddress: '0x0000000000000000000000000000000000000001', planetType: 'Nebula', baseMineralsPerDay: 100n, generatedAt: new Date('2026-08-03T00:00:00.000Z') },
          { id: 'planet-4', ownerAddress: '0x0000000000000000000000000000000000000001', planetType: 'Gaia', baseMineralsPerDay: 100n, generatedAt: new Date('2026-08-03T00:00:00.000Z') },
        ],
      },
    } as unknown as PrismaClient;

    const snapshot = await getBackendWalletMiningSnapshot(
      prisma,
      '0x0000000000000000000000000000000000000001',
      new Date('2026-08-04T00:00:00.000Z'),
    );

    expect(snapshot.ownedPlanetCount).toBe(4);
    expect(snapshot.effectiveMineralsPerDayMicros).toBe('415000000');
    expect(snapshot.planets.filter((planet) => planet.planetId !== 'planet-4')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ planetId: 'planet-1', sameTypeCount: 3, collectionBonusBps: 500, effectiveMineralsPerDayMicros: '105000000' }),
        expect.objectContaining({ planetId: 'planet-2', sameTypeCount: 3, collectionBonusBps: 500, effectiveMineralsPerDayMicros: '105000000' }),
        expect.objectContaining({ planetId: 'planet-3', sameTypeCount: 3, collectionBonusBps: 500, effectiveMineralsPerDayMicros: '105000000' }),
      ]),
    );
    expect(snapshot.planets.find((planet) => planet.planetId === 'planet-4')).toMatchObject({ sameTypeCount: 1, collectionBonusBps: 0, effectiveMineralsPerDayMicros: '100000000' });
  });

  it('reads one backend Planet by id with its wallet collection context', async () => {
    const prisma = {
      backendPlanet: {
        findFirst: async () => ({
          id: 'planet-7', ownerAddress: '0x0000000000000000000000000000000000000002',
          planetType: 'Gaia', baseMineralsPerDay: 10n, generatedAt: new Date('2026-08-10T00:00:00.000Z'),
        }),
        findMany: async () => [
          { id: 'planet-7', ownerAddress: '0x0000000000000000000000000000000000000002', planetType: 'Gaia', baseMineralsPerDay: 10n, generatedAt: new Date('2026-08-10T00:00:00.000Z') },
          { id: 'planet-8', ownerAddress: '0x0000000000000000000000000000000000000002', planetType: 'Gaia', baseMineralsPerDay: 10n, generatedAt: new Date('2026-08-11T00:00:00.000Z') },
          { id: 'planet-9', ownerAddress: '0x0000000000000000000000000000000000000002', planetType: 'Gaia', baseMineralsPerDay: 10n, generatedAt: new Date('2026-08-12T00:00:00.000Z') },
        ],
      },
    } as unknown as PrismaClient;
    const snapshot = await getBackendPlanetMiningSnapshot(prisma, 'planet-7', new Date('2026-08-13T00:00:00.000Z'));
    expect(snapshot).toMatchObject({ planetId: 'planet-7', earnedMicros: '30500000', planetType: 'Gaia', sameTypeCount: 3, collectionBonusBps: 500, effectiveMineralsPerDayMicros: '10500000' });
  });

  it('reads a virtual post-cutover account without creating or settling it', async () => {
    const mineralAccount = {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    };
    const prisma = {
      backendPlanet: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'planet-v2',
            ownerAddress: '0x0000000000000000000000000000000000000001',
            planetType: 'Nebula',
            planetName: 'V2 Planet',
            seed: `0x${'11'.repeat(32)}`,
            traitsHash: `0x${'22'.repeat(32)}`,
            generatorVersion: 1,
            terrain: 'Plains',
            rarity: 'Common',
            satelliteCount: 0,
            hasRing: false,
            baseMineralsPerDay: 1n,
            upgradeLevel: 0,
            upgradeBonusBps: 0,
            generatedAt: new Date('2026-08-19T00:00:00.000Z'),
          },
        ]),
      },
      mineralAccount,
      planetUpgradePurchase: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as PrismaClient;

    const snapshot = await getBackendWalletMiningSnapshot(
      prisma,
      '0x0000000000000000000000000000000000000001',
      new Date('2026-08-21T00:00:00.000Z'),
      {
        mineralEconomyCutoverAt: new Date('2026-08-20T00:00:00.000Z'),
        mineralUpgradesEnabled: true,
      },
    );

    expect(snapshot).toMatchObject({
      ownerAddress: '0x0000000000000000000000000000000000000001',
      currentBalanceMicros: '2000000',
      effectiveMineralsPerDayMicros: '1000000',
      ownedPlanetCount: 1,
      upgradesEnabled: true,
    });
    expect(snapshot.planets[0]).toMatchObject({
      planetId: 'planet-v2',
      upgradeLevel: 0,
      upgradeBonusBps: 0,
      nextUpgrade: { targetLevel: 1, bonusBpsAfter: 1000, costMicros: '200000' },
    });
    expect(mineralAccount.findUnique).toHaveBeenCalledOnce();
    expect(mineralAccount.create).not.toHaveBeenCalled();
    expect(mineralAccount.update).not.toHaveBeenCalled();
    expect(mineralAccount.upsert).not.toHaveBeenCalled();
  });

  it('uses purchase history for post-cutover production and current upgrade rate', async () => {
    const cutoverAt = new Date('2026-08-20T00:00:00.000Z');
    const purchaseAt = new Date('2026-08-20T12:34:56.789Z');
    const asOf = new Date('2026-08-21T00:00:00.001Z');
    const prisma = {
      backendPlanet: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'planet-history',
            ownerAddress: '0x0000000000000000000000000000000000000001',
            planetType: 'Nebula',
            planetName: 'History Planet',
            seed: `0x${'11'.repeat(32)}`,
            traitsHash: `0x${'22'.repeat(32)}`,
            generatorVersion: 1,
            terrain: 'Plains',
            rarity: 'Common',
            satelliteCount: 0,
            hasRing: false,
            baseMineralsPerDay: 1n,
            upgradeLevel: 1,
            upgradeBonusBps: 1_000,
            generatedAt: cutoverAt,
          },
        ]),
      },
      mineralAccount: {
        findUnique: vi.fn().mockResolvedValue({
          ownerAddress: '0x0000000000000000000000000000000000000001',
          balanceMicros: 0n,
          lastSettledAt: cutoverAt,
        }),
      },
      planetUpgradePurchase: {
        findMany: vi.fn().mockResolvedValue([
          { planetId: 'planet-history', targetLevel: 1, bonusBpsAfter: 1_000, purchasedAt: purchaseAt },
        ]),
      },
    } as unknown as PrismaClient;

    const snapshot = await getBackendWalletMiningSnapshot(
      prisma,
      '0x0000000000000000000000000000000000000001',
      asOf,
      { mineralEconomyCutoverAt: cutoverAt, mineralUpgradesEnabled: true },
    );

    expect((snapshot as { currentBalanceMicros: string }).currentBalanceMicros).toBe('1047573');
    expect(snapshot.planets[0]).toMatchObject({
      effectiveMineralsPerDayMicros: '1100000',
      earnedMicros: '1047573',
      upgradeLevel: 1,
      upgradeBonusBps: 1000,
    });
  });
});
