import { Prisma, type PrismaClient } from './generated/prisma/client.js';
import { calculateAchievements } from './achievements.js';
import {
  calculateEffectiveMineralsPerDayMicros,
  calculateCollectionMining,
  type CollectionMiningPlanet,
} from './collectionMining.js';
import {
  calculateHistoricalPlanetProduction,
  collectionBonusBpsAt,
  galaxyPulseBpsAt,
  type MineralCollectionPlanet,
  type MineralUpgradePurchase,
} from './mineralEconomy.js';
import { loadGalaxyPulseRounds, serializeCurrentGalaxyPulse } from './galaxyPulseStore.js';
import {
  calculateCurrentMineralBalanceMicros,
  calculateV1WalletOpeningBalance,
  getPostgresClockTimestamp,
  resolveMineralEconomyForOperation,
} from './mineralAccounts.js';
import { getNextMineralUpgrade } from './mineralUpgrades.js';

type BackendMiningPlanetRow = CollectionMiningPlanet;

export type WalletMiningEconomyOptions = {
  mineralEconomyCutoverAt?: Date | null;
  mineralUpgradesEnabled?: boolean;
};

export async function getBackendWalletMiningSnapshot(
  prisma: PrismaClient,
  ownerAddress: string,
  now: Date,
  options: WalletMiningEconomyOptions = {},
) {
  const resolution = await resolveMineralEconomyForOperation(
    prisma,
    options.mineralEconomyCutoverAt,
  );
  if (resolution.state === 'V1') return getV1WalletMiningSnapshot(prisma, ownerAddress, now);

  return prisma.$transaction(
    async (transaction) => {
      const hasPostgresClock = typeof transaction.$queryRaw === 'function';
      let asOf = hasPostgresClock ? await getPostgresClockTimestamp(transaction) : now;
      const transactionResolution = await resolveMineralEconomyForOperation(
        transaction,
        options.mineralEconomyCutoverAt,
        asOf,
      );
      // Unit-only Prisma doubles lack PostgreSQL's clock; production clients require a persisted row.
      const cutoverAt = transactionResolution.state === 'V2' || !hasPostgresClock || !transaction.mineralEconomyCutover
        ? transactionResolution.cutoverAt
        : null;
      if (!cutoverAt) {
        return getV1WalletMiningSnapshot(
          transaction as unknown as PrismaClient,
          ownerAddress,
          asOf,
        );
      }
      const account = await transaction.mineralAccount.findUnique({
        where: { ownerAddress: ownerAddress.toLowerCase() },
      });
      if (!hasPostgresClock && account?.lastSettledAt && account.lastSettledAt > asOf) {
        asOf = account.lastSettledAt;
      }
      if (asOf < cutoverAt) {
        return getV1WalletMiningSnapshot(
          transaction as unknown as PrismaClient,
          ownerAddress,
          asOf,
        );
      }
      const pulseRounds = transaction.galaxyPulseRound
        ? await loadGalaxyPulseRounds(transaction, asOf)
        : [];
      const planets = await transaction.backendPlanet.findMany({
        where: { ownerAddress: ownerAddress.toLowerCase(), status: 'READY', generatedAt: { lte: asOf } },
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
      const activePlanets = planets.filter((planet) => planet.generatedAt.getTime() <= asOf.getTime());
      const economyPlanets = activePlanets as unknown as MineralCollectionPlanet[];
      const purchaseRows = await transaction.planetUpgradePurchase.findMany({
        where: { walletAddress: ownerAddress.toLowerCase(), purchasedAt: { lte: asOf } },
        orderBy: [{ purchasedAt: 'asc' }, { id: 'asc' }],
        select: { planetId: true, targetLevel: true, bonusBpsAfter: true, purchasedAt: true },
      });
      const purchases = purchaseRows.filter((purchase) => purchase.purchasedAt.getTime() <= asOf.getTime()) as MineralUpgradePurchase[];
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
      const currentBalanceMicros = calculateCurrentMineralBalanceMicros({
        account,
        openingBalanceMicros,
        cutoverAt,
        asOf,
        planets: economyPlanets,
        purchases,
        pulseRounds,
      });
      const preCutoverCalculations = calculateCollectionMining({
        planets: openingPlanets as BackendMiningPlanetRow[],
        asOf: cutoverAt,
      });
      let effectiveMineralsPerDayMicros = 0n;
      const snapshots = activePlanets.map((planet) => {
        const collectionBonusBps = collectionBonusBpsAt(economyPlanets, asOf, planet);
        const sameTypeCount = economyPlanets.filter(
          (candidate) =>
            candidate.ownerAddress.toLowerCase() === planet.ownerAddress.toLowerCase() &&
            candidate.planetType === planet.planetType &&
            candidate.generatedAt && candidate.generatedAt.getTime() <= asOf.getTime(),
        ).length;
        const upgradeBonusBps = planet.upgradeBonusBps;
        const galaxyPulseBps = galaxyPulseBpsAt(pulseRounds, planet.planetType, asOf.getTime());
        const effectiveRate = calculateEffectiveMineralsPerDayMicros(
          planet.baseMineralsPerDay,
          collectionBonusBps + upgradeBonusBps + galaxyPulseBps,
        );
        effectiveMineralsPerDayMicros += effectiveRate;
        const preCutoverEarned = preCutoverCalculations.get(planet.id)?.earnedMicros ?? 0n;
        const postCutoverEarned = calculateHistoricalPlanetProduction({
          planet,
          planets: economyPlanets,
          purchases,
          from: cutoverAt,
          to: asOf,
          anchor: cutoverAt,
          pulseRounds,
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
          galaxyPulseBps,
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
      const snapshot = {
        ownerAddress: ownerAddress.toLowerCase(),
        asOf: asOf.toISOString(),
        ownedPlanetCount: snapshots.length,
        currentBalanceMicros: currentBalanceMicros.toString(),
        effectiveMineralsPerDayMicros: effectiveMineralsPerDayMicros.toString(),
        upgradesEnabled: options.mineralUpgradesEnabled === true,
        galaxyPulse: serializeCurrentGalaxyPulse(pulseRounds.at(-1) ?? null),
        planets: snapshots,
      };
      return { ...snapshot, achievements: calculateAchievements(snapshot) };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}

async function getV1WalletMiningSnapshot(prisma: PrismaClient, ownerAddress: string, now: Date) {
  const planets = await prisma.backendPlanet.findMany({
    where: { ownerAddress: ownerAddress.toLowerCase(), status: 'READY' },
    select: {
      id: true,
      ownerAddress: true,
      planetType: true,
      rarity: true,
      baseMineralsPerDay: true,
      upgradeLevel: true,
      generatedAt: true,
    },
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
      rarity: planet.rarity,
      baseMineralsPerDay: planet.baseMineralsPerDay.toString(),
      planetType: calculated.planetType,
      sameTypeCount: calculated.sameTypeCount,
      collectionBonusBps: calculated.collectionBonusBps,
      upgradeLevel: planet.upgradeLevel,
      galaxyPulseBps: 0,
      effectiveMineralsPerDayMicros: calculated.effectiveMineralsPerDayMicros.toString(),
      earnedMicros: calculated.earnedMicros.toString(),
      activeSince: planet.generatedAt.toISOString(),
    }];
  });
  const snapshot = {
    ownerAddress,
    asOf: now.toISOString(),
    ownedPlanetCount: snapshots.length,
    earnedMicros: earnedMicros.toString(),
    currentBalanceMicros: earnedMicros.toString(),
    effectiveMineralsPerDayMicros: effectiveMineralsPerDayMicros.toString(),
    upgradesEnabled: false,
    galaxyPulse: null,
    planets: snapshots,
  };
  return { ...snapshot, achievements: calculateAchievements(snapshot) };
}
