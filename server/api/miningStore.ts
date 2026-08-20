import type { PrismaClient } from './generated/prisma/client.js';
import {
  calculateEffectiveMineralsPerDayMicros,
  calculateCollectionMining,
  type CollectionMiningPlanet,
} from './collectionMining.js';
import {
  calculateHistoricalPlanetProduction,
  calculateHistoricalProduction,
  collectionBonusBpsAt,
  type MineralCollectionPlanet,
  type MineralUpgradePurchase,
} from './mineralEconomy.js';
import { calculateV1WalletOpeningBalance } from './mineralAccounts.js';
import { getNextMineralUpgrade } from './mineralUpgrades.js';

type BackendMiningPlanetRow = CollectionMiningPlanet;

export type WalletMiningEconomyOptions = {
  mineralEconomyCutoverAt?: Date | null;
  mineralUpgradesEnabled?: boolean;
};

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
  options: WalletMiningEconomyOptions = {},
) {
  const cutoverAt = options.mineralEconomyCutoverAt;
  if (!cutoverAt || now < cutoverAt) return getV1WalletMiningSnapshot(prisma, ownerAddress, now);
  if (!Number.isFinite(cutoverAt.getTime())) throw new Error('Mineral economy cutover timestamp is invalid.');

  const planets = await prisma.backendPlanet.findMany({
    where: { ownerAddress: ownerAddress.toLowerCase(), status: 'READY' },
    select: {
      id: true,
      ownerAddress: true,
      planetType: true,
      planetName: true,
      seed: true,
      traitsHash: true,
      generatorVersion: true,
      terrain: true,
      rarity: true,
      satelliteCount: true,
      hasRing: true,
      baseMineralsPerDay: true,
      upgradeLevel: true,
      upgradeBonusBps: true,
      generatedAt: true,
    },
    orderBy: [{ generatedAt: 'desc' }, { id: 'asc' }],
  });
  const activePlanets = planets.filter((planet) => planet.generatedAt.getTime() <= now.getTime());
  const economyPlanets = activePlanets as unknown as MineralCollectionPlanet[];
  const account = await prisma.mineralAccount.findUnique({
    where: { ownerAddress: ownerAddress.toLowerCase() },
  });
  const purchaseRows = await prisma.planetUpgradePurchase.findMany({
    where: { walletAddress: ownerAddress.toLowerCase(), purchasedAt: { lte: now } },
    orderBy: [{ purchasedAt: 'asc' }, { id: 'asc' }],
    select: { planetId: true, targetLevel: true, bonusBpsAfter: true, purchasedAt: true },
  });
  const purchases = purchaseRows as MineralUpgradePurchase[];
  const openingPlanets = economyPlanets.filter((planet) => planet.generatedAt && planet.generatedAt <= cutoverAt);
  const openingBalanceMicros = calculateV1WalletOpeningBalance(
    openingPlanets.map((planet) => ({
      id: planet.id,
      ownerAddress: planet.ownerAddress,
      planetType: planet.planetType,
      baseMineralsPerDay: planet.baseMineralsPerDay,
      generatedAt: planet.generatedAt as Date,
    })),
    cutoverAt,
  );
  const pendingFrom = account?.lastSettledAt && account.lastSettledAt > cutoverAt ? account.lastSettledAt : cutoverAt;
  const pendingProductionMicros = calculateHistoricalProduction({
    planets: economyPlanets,
    purchases,
    from: pendingFrom,
    to: now,
    anchor: cutoverAt,
  });
  const currentBalanceMicros = account
    ? account.balanceMicros + pendingProductionMicros
    : openingBalanceMicros + pendingProductionMicros;
  const preCutoverCalculations = calculateCollectionMining({
    planets: openingPlanets as BackendMiningPlanetRow[],
    asOf: cutoverAt,
  });
  let effectiveMineralsPerDayMicros = 0n;
  const snapshots = activePlanets.map((planet) => {
    const collectionBonusBps = collectionBonusBpsAt(economyPlanets, now, planet);
    const sameTypeCount = economyPlanets.filter(
      (candidate) =>
        candidate.ownerAddress.toLowerCase() === planet.ownerAddress.toLowerCase() &&
        candidate.planetType === planet.planetType &&
        candidate.generatedAt && candidate.generatedAt.getTime() <= now.getTime(),
    ).length;
    const latestPurchase = [...purchases]
      .filter((purchase) => purchase.planetId === planet.id && purchase.purchasedAt.getTime() <= now.getTime())
      .sort((left, right) => right.purchasedAt.getTime() - left.purchasedAt.getTime())[0];
    const upgradeBonusBps = latestPurchase?.bonusBpsAfter ?? 0;
    const effectiveRate = calculateEffectiveMineralsPerDayMicros(
      planet.baseMineralsPerDay,
      collectionBonusBps + upgradeBonusBps,
    );
    effectiveMineralsPerDayMicros += effectiveRate;
    const preCutoverEarned = preCutoverCalculations.get(planet.id)?.earnedMicros ?? 0n;
    const postCutoverEarned = calculateHistoricalPlanetProduction({
      planet,
      planets: economyPlanets,
      purchases,
      from: cutoverAt,
      to: now,
      anchor: cutoverAt,
    });
    let nextUpgrade = null;
    try {
      nextUpgrade = getNextMineralUpgrade({
        baseMineralsPerDay: planet.baseMineralsPerDay,
        upgradeLevel: planet.upgradeLevel,
        upgradeBonusBps: planet.upgradeBonusBps,
      });
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('bonus delta')) throw error;
    }
    return {
      planetId: planet.id,
      planetName: planet.planetName,
      seed: planet.seed,
      traitsHash: planet.traitsHash,
      generatorVersion: planet.generatorVersion,
      terrain: planet.terrain,
      rarity: planet.rarity,
      satelliteCount: planet.satelliteCount,
      hasRing: planet.hasRing,
      baseMineralsPerDay: planet.baseMineralsPerDay.toString(),
      planetType: planet.planetType,
      sameTypeCount,
      collectionBonusBps,
      upgradeLevel: planet.upgradeLevel,
      upgradeBonusBps: planet.upgradeBonusBps,
      effectiveMineralsPerDayMicros: effectiveRate.toString(),
      earnedMicros: (preCutoverEarned + postCutoverEarned).toString(),
      activeSince: planet.generatedAt.toISOString(),
      nextUpgrade: nextUpgrade
        ? {
            targetLevel: nextUpgrade.targetLevel,
            bonusBpsAfter: nextUpgrade.bonusBpsAfter,
            costMicros: nextUpgrade.costMicros.toString(),
          }
        : null,
    };
  });
  return {
    ownerAddress: ownerAddress.toLowerCase(),
    asOf: now.toISOString(),
    ownedPlanetCount: snapshots.length,
    earnedMicros: currentBalanceMicros.toString(),
    currentBalanceMicros: currentBalanceMicros.toString(),
    effectiveMineralsPerDayMicros: effectiveMineralsPerDayMicros.toString(),
    upgradesEnabled: options.mineralUpgradesEnabled === true,
    planets: snapshots,
  };
}

async function getV1WalletMiningSnapshot(prisma: PrismaClient, ownerAddress: string, now: Date) {
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
    currentBalanceMicros: earnedMicros.toString(),
    effectiveMineralsPerDayMicros: effectiveMineralsPerDayMicros.toString(),
    upgradesEnabled: false,
    planets: snapshots,
  };
}
