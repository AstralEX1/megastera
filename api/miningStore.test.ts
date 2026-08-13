import { describe, expect, it } from 'vitest';
import type { PrismaClient } from './generated/prisma/client';
import { getBackendPlanetMiningSnapshot, getBackendWalletMiningSnapshot } from './miningStore';

describe('backend Planet mining snapshots', () => {
  it('calculates lifetime production from backend-generatedAt', async () => {
    const prisma = {
      backendPlanet: {
        findMany: async () => [
          { id: 'planet-1', baseMineralsPerDay: 86_400n, generatedAt: new Date('2026-08-10T00:00:00.000Z') },
          { id: 'planet-2', baseMineralsPerDay: 172_800n, generatedAt: new Date('2026-08-09T00:00:00.000Z') },
        ],
      },
    } as unknown as PrismaClient;
    const snapshot = await getBackendWalletMiningSnapshot(prisma, '0x0000000000000000000000000000000000000001', new Date('2026-08-10T00:00:01.000Z'));
    expect(snapshot.ownedPlanetCount).toBe(2);
    expect(snapshot.earnedMicros).toBe('172803000000');
    expect(snapshot.planets[0]?.planetId).toBe('planet-1');
  });

  it('reads one backend Planet by id', async () => {
    const prisma = {
      backendPlanet: {
        findFirst: async () => ({
          id: 'planet-7', ownerAddress: '0x0000000000000000000000000000000000000002',
          baseMineralsPerDay: 10n, generatedAt: new Date('2026-08-10T00:00:00.000Z'),
        }),
      },
    } as unknown as PrismaClient;
    const snapshot = await getBackendPlanetMiningSnapshot(prisma, 'planet-7', new Date('2026-08-12T00:00:00.000Z'));
    expect(snapshot).toMatchObject({ planetId: 'planet-7', earnedMicros: '20000000' });
  });
});
