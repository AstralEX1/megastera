import { describe, expect, it } from 'vitest';
import type { PrismaClient } from './generated/prisma/client';
import { getBackendPlanetMiningSnapshot, getBackendWalletMiningSnapshot } from './miningStore';

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
});
