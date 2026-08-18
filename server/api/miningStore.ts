import type { PrismaClient } from './generated/prisma/client';
import {
  calculateCollectionMining,
  type CollectionMiningPlanet,
} from './collectionMining';

type BackendMiningPlanetRow = CollectionMiningPlanet;

export async function getBackendPlanetMiningSnapshot(
  prisma: PrismaClient,
  planetId: string,
  now: Date,
) {
  const planet = await prisma.backendPlanet.findFirst({
    where: { id: planetId, status: 'READY' },
    select: { id: true, ownerAddress: true, planetType: true, baseMineralsPerDay: true, generatedAt: true },
  });
  if (!planet) return undefined;
  const planets = await prisma.backendPlanet.findMany({
    where: { ownerAddress: planet.ownerAddress, status: 'READY' },
    select: { id: true, ownerAddress: true, planetType: true, baseMineralsPerDay: true, generatedAt: true },
  });
  const calculated = calculateCollectionMining({ planets: planets as BackendMiningPlanetRow[], asOf: now }).get(planet.id);
  if (!calculated) return undefined;
  return {
    planetId: planet.id,
    ownerAddress: planet.ownerAddress,
    baseMineralsPerDay: planet.baseMineralsPerDay.toString(),
    planetType: calculated.planetType,
    sameTypeCount: calculated.sameTypeCount,
    collectionBonusBps: calculated.collectionBonusBps,
    effectiveMineralsPerDayMicros: calculated.effectiveMineralsPerDayMicros.toString(),
    earnedMicros: calculated.earnedMicros.toString(),
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
    select: { id: true, ownerAddress: true, planetType: true, baseMineralsPerDay: true, generatedAt: true },
    orderBy: [{ generatedAt: 'desc' }, { id: 'asc' }],
  });
  const calculations = calculateCollectionMining({ planets: planets as BackendMiningPlanetRow[], asOf: now });
  let earnedMicros = 0n;
  let effectiveMineralsPerDayMicros = 0n;
  const snapshots = planets.flatMap((planet) => {
    const calculated = calculations.get(planet.id);
    if (!calculated) return [];
    earnedMicros += calculated.earnedMicros;
    effectiveMineralsPerDayMicros += calculated.effectiveMineralsPerDayMicros;
    return [{
      planetId: planet.id,
      baseMineralsPerDay: planet.baseMineralsPerDay.toString(),
      planetType: calculated.planetType,
      sameTypeCount: calculated.sameTypeCount,
      collectionBonusBps: calculated.collectionBonusBps,
      effectiveMineralsPerDayMicros: calculated.effectiveMineralsPerDayMicros.toString(),
      earnedMicros: calculated.earnedMicros.toString(),
      activeSince: planet.generatedAt.toISOString(),
    }];
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
