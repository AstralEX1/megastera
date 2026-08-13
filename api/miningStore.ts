import type { PrismaClient } from './generated/prisma/client';
import { calculateLifetimeMinerals, MINERAL_SCALE } from './mining';

export async function getBackendPlanetMiningSnapshot(
  prisma: PrismaClient,
  planetId: string,
  now: Date,
) {
  const planet = await prisma.backendPlanet.findFirst({
    where: { id: planetId, status: 'READY' },
    select: { id: true, ownerAddress: true, baseMineralsPerDay: true, generatedAt: true },
  });
  if (!planet) return undefined;
  const earnedMicros = calculateLifetimeMinerals({
    baseMineralsPerDay: planet.baseMineralsPerDay,
    mintedAt: planet.generatedAt,
    asOf: now,
  });
  return {
    planetId: planet.id,
    ownerAddress: planet.ownerAddress,
    baseMineralsPerDay: planet.baseMineralsPerDay.toString(),
    effectiveMineralsPerDayMicros: (planet.baseMineralsPerDay * MINERAL_SCALE).toString(),
    earnedMicros: earnedMicros.toString(),
    activeSince: planet.generatedAt.toISOString(),
  };
}

export async function getBackendWalletMiningSnapshot(
  prisma: PrismaClient,
  ownerAddress: string,
  now: Date,
) {
  const planets = await prisma.backendPlanet.findMany({
    where: { ownerAddress: ownerAddress.toLowerCase(), status: 'READY' },
    select: { id: true, baseMineralsPerDay: true, generatedAt: true },
    orderBy: [{ generatedAt: 'desc' }, { id: 'asc' }],
  });
  let earnedMicros = 0n;
  let effectiveMineralsPerDayMicros = 0n;
  const snapshots = planets.map((planet) => {
    const earned = calculateLifetimeMinerals({
      baseMineralsPerDay: planet.baseMineralsPerDay,
      mintedAt: planet.generatedAt,
      asOf: now,
    });
    const effective = planet.baseMineralsPerDay * MINERAL_SCALE;
    earnedMicros += earned;
    effectiveMineralsPerDayMicros += effective;
    return {
      planetId: planet.id,
      baseMineralsPerDay: planet.baseMineralsPerDay.toString(),
      effectiveMineralsPerDayMicros: effective.toString(),
      earnedMicros: earned.toString(),
      activeSince: planet.generatedAt.toISOString(),
    };
  });
  return {
    ownerAddress,
    asOf: now.toISOString(),
    ownedPlanetCount: snapshots.length,
    earnedMicros: earnedMicros.toString(),
    effectiveMineralsPerDayMicros: effectiveMineralsPerDayMicros.toString(),
    planets: snapshots,
  };
}
