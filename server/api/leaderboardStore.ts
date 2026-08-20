import { Prisma, type PrismaClient } from './generated/prisma/client.js';
import {
  calculateCollectionMining,
  calculateEffectiveMineralsPerDayMicros,
  type CollectionMiningPlanet,
} from './collectionMining.js';
import {
  getDistanceToNextRank,
  getLeaderboardPeriod,
  type LeaderboardPeriodBounds,
  type RankedLeaderboardRow,
  rankLeaderboardRows,
} from './leaderboard.js';
import {
  calculateHistoricalProduction,
  upgradeBonusBpsAt,
  type MineralCollectionPlanet,
  type MineralUpgradePurchase,
} from './mineralEconomy.js';
import {
  acquireMineralEconomyExclusiveBarrier,
  calculateV1WalletOpeningBalance,
  getPostgresClockTimestamp,
  resolveMineralEconomyCutover,
} from './mineralAccounts.js';
import { calculateLifetimeMinerals, MINERAL_SCALE } from './mining.js';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export type LifetimeLeaderboardPlanet = {
  id: string;
  ownerAddress: string;
  baseMineralsPerDay: bigint | null;
  planetType?: string | null;
  mintedAt: Date;
};

export type LiveLeaderboardPlanet = {
  id: string;
  ownerAddress: string;
  baseMineralsPerDay: bigint | null;
  planetType: string;
  generatedAt: Date;
};

export type LiveLeaderboardSnapshot = {
  asOf: Date;
  rows: RankedLeaderboardRow[];
};

export type LeaderboardEconomyOptions = {
  mineralEconomyCutoverAt?: Date | null;
};

type SpendableLeaderboardAccount = {
  ownerAddress: string;
  openingBalanceMicros: bigint;
};

type SpendableLeaderboardPlanet = MineralCollectionPlanet & {
  baseMineralsPerDay: bigint;
  generatedAt: Date;
};

type SpendableLeaderboardPurchase = MineralUpgradePurchase & {
  walletAddress?: string;
  costMicros: bigint;
};

type Pagination = { offset: number; limit: number };

function addToMap(target: Map<string, bigint>, address: string, amount: bigint) {
  const normalizedAddress = address.toLowerCase();
  target.set(normalizedAddress, (target.get(normalizedAddress) ?? 0n) + amount);
}

type LeaderboardMiningPlanet = {
  id: string;
  ownerAddress: string;
  baseMineralsPerDay: bigint | null;
  planetType?: string | null;
  generatedAt: Date;
};

function getCollectionMiningResults(
  planets: readonly LeaderboardMiningPlanet[],
  asOf: Date,
) {
  const typedPlanets: CollectionMiningPlanet[] = planets.flatMap((planet) =>
    planet.baseMineralsPerDay !== null && typeof planet.planetType === 'string'
      ? [{
          id: planet.id,
          ownerAddress: planet.ownerAddress,
          planetType: planet.planetType,
          baseMineralsPerDay: planet.baseMineralsPerDay,
          generatedAt: planet.generatedAt,
        }]
      : [],
  );
  return calculateCollectionMining({ planets: typedPlanets, asOf });
}

/** Calculates a daily snapshot directly from immutable Planet traits. */
export function calculateLeaderboardRows(input: {
  period?: LeaderboardPeriodBounds;
  asOf: Date;
  planets: readonly LifetimeLeaderboardPlanet[];
}): RankedLeaderboardRow[] {
  const period = input.period ?? getLeaderboardPeriod(input.asOf);
  const cutoff = new Date(Math.min(input.asOf.getTime(), period.endsAt.getTime()));
  const scoreByWallet = new Map<string, bigint>();
  const rateByWallet = new Map<string, bigint>();
  const eligiblePlanets = input.planets.filter(
    (planet): planet is LifetimeLeaderboardPlanet & { baseMineralsPerDay: bigint } =>
      planet.baseMineralsPerDay !== null &&
      planet.ownerAddress.toLowerCase() !== ZERO_ADDRESS &&
      planet.mintedAt.getTime() < cutoff.getTime(),
  );
  const collectionResults = getCollectionMiningResults(
    eligiblePlanets.map((planet) => ({
      id: planet.id,
      ownerAddress: planet.ownerAddress,
      baseMineralsPerDay: planet.baseMineralsPerDay,
      planetType: planet.planetType,
      generatedAt: planet.mintedAt,
    })),
    cutoff,
  );

  for (const planet of eligiblePlanets) {
    const collection = planet.planetType ? collectionResults.get(planet.id) : undefined;
    const score = collection?.earnedMicros ?? calculateLifetimeMinerals({
      baseMineralsPerDay: planet.baseMineralsPerDay,
      mintedAt: planet.mintedAt,
      asOf: cutoff,
    });
    if (score > 0n) addToMap(scoreByWallet, planet.ownerAddress, score);
    addToMap(
      rateByWallet,
      planet.ownerAddress,
      collection?.effectiveMineralsPerDayMicros ?? planet.baseMineralsPerDay * MINERAL_SCALE,
    );
  }

  return rankLeaderboardRows(
    [...scoreByWallet].map(([walletAddress, scoreMicros]) => ({
      walletAddress,
      scoreMicros,
      effectiveMineralsPerDayMicros: rateByWallet.get(walletAddress) ?? 0n,
    })),
  );
}

/** Calculates current lifetime production from active backend Planet rows. */
export function calculateLiveLeaderboardRows(input: {
  asOf: Date;
  planets: readonly LiveLeaderboardPlanet[];
}): RankedLeaderboardRow[] {
  const scoreByWallet = new Map<string, bigint>();
  const rateByWallet = new Map<string, bigint>();
  const eligiblePlanets = input.planets.filter(
    (planet): planet is LiveLeaderboardPlanet & { baseMineralsPerDay: bigint } =>
      planet.baseMineralsPerDay !== null &&
      planet.baseMineralsPerDay > 0n &&
      planet.ownerAddress.toLowerCase() !== ZERO_ADDRESS &&
      planet.generatedAt.getTime() <= input.asOf.getTime(),
  );
  const collectionResults = getCollectionMiningResults(eligiblePlanets, input.asOf);

  for (const planet of eligiblePlanets) {
    const collection = collectionResults.get(planet.id);
    const score = collection?.earnedMicros ?? calculateLifetimeMinerals({
      baseMineralsPerDay: planet.baseMineralsPerDay,
      mintedAt: planet.generatedAt,
      asOf: input.asOf,
    });
    if (score > 0n) addToMap(scoreByWallet, planet.ownerAddress, score);
    addToMap(
      rateByWallet,
      planet.ownerAddress,
      collection?.effectiveMineralsPerDayMicros ?? planet.baseMineralsPerDay * MINERAL_SCALE,
    );
  }

  return rankLeaderboardRows(
    [...scoreByWallet].map(([walletAddress, scoreMicros]) => ({
      walletAddress,
      scoreMicros,
      effectiveMineralsPerDayMicros: rateByWallet.get(walletAddress) ?? 0n,
    })),
  );
}

function groupByOwner<T>(rows: readonly T[], getOwnerAddress: (row: T) => string) {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const ownerAddress = getOwnerAddress(row).toLowerCase();
    const ownerRows = grouped.get(ownerAddress) ?? [];
    ownerRows.push(row);
    grouped.set(ownerAddress, ownerRows);
  }
  return grouped;
}

/** Reconstructs post-cutover spendable balances at one half-open period boundary. */
export function calculatePostCutoverLeaderboardRows(input: {
  period?: LeaderboardPeriodBounds;
  asOf: Date;
  cutoverAt: Date;
  includeEventsAtAsOf?: boolean;
  accounts: readonly SpendableLeaderboardAccount[];
  planets: readonly SpendableLeaderboardPlanet[];
  purchases: readonly SpendableLeaderboardPurchase[];
}): RankedLeaderboardRow[] {
  if (!Number.isFinite(input.cutoverAt.getTime()))
    throw new Error('Mineral economy cutover timestamp is invalid.');
  const period = input.period ?? getLeaderboardPeriod(input.asOf);
  const cutoff = new Date(Math.min(input.asOf.getTime(), period.endsAt.getTime()));
  const includeEventsAtAsOf = input.includeEventsAtAsOf === true;
  if (cutoff.getTime() < input.cutoverAt.getTime())
    throw new Error('Post-cutover leaderboard timestamp cannot be before cutover.');

  const activePlanets = input.planets.filter(
    (planet) =>
      planet.baseMineralsPerDay > 0n &&
      planet.ownerAddress.toLowerCase() !== ZERO_ADDRESS &&
      (planet.generatedAt.getTime() < cutoff.getTime() ||
        (includeEventsAtAsOf && planet.generatedAt.getTime() === cutoff.getTime())),
  );
  const planetsByOwner = groupByOwner(activePlanets, (planet) => planet.ownerAddress);
  const ownerByPlanetId = new Map(
    input.planets.map((planet) => [planet.id, planet.ownerAddress]),
  );
  const purchasesByOwner = groupByOwner(
    input.purchases.filter(
      (purchase) =>
        purchase.purchasedAt.getTime() < cutoff.getTime() ||
        (includeEventsAtAsOf && purchase.purchasedAt.getTime() === cutoff.getTime()),
    ),
    (purchase) => purchase.walletAddress ?? ownerByPlanetId.get(purchase.planetId) ?? ZERO_ADDRESS,
  );
  const accountsByOwner = new Map(
    input.accounts.map((account) => [account.ownerAddress.toLowerCase(), account]),
  );
  const collectionResults = calculateCollectionMining({ planets: activePlanets, asOf: cutoff });
  const scoreByWallet = new Map<string, bigint>();
  const rateByWallet = new Map<string, bigint>();
  const owners = new Set([
    ...accountsByOwner.keys(),
    ...planetsByOwner.keys(),
    ...purchasesByOwner.keys(),
  ]);

  for (const ownerAddress of owners) {
    const planets = planetsByOwner.get(ownerAddress) ?? [];
    const purchases = purchasesByOwner.get(ownerAddress) ?? [];
    const account = accountsByOwner.get(ownerAddress);
    const openingPlanets = input.planets.filter(
      (planet) =>
        planet.ownerAddress.toLowerCase() === ownerAddress &&
        planet.generatedAt.getTime() <= input.cutoverAt.getTime(),
    );
    const openingBalanceMicros = account?.openingBalanceMicros ?? calculateV1WalletOpeningBalance(
      openingPlanets,
      input.cutoverAt,
    );
    const producedMicros = calculateHistoricalProduction({
      planets,
      purchases,
      from: input.cutoverAt,
      to: cutoff,
      anchor: input.cutoverAt,
    });
    const purchaseCostsMicros = purchases.reduce((total, purchase) => total + purchase.costMicros, 0n);
    const scoreMicros = openingBalanceMicros + producedMicros - purchaseCostsMicros;
    if (scoreMicros < 0n) {
      throw new Error(`Reconstructed leaderboard balance is negative for ${ownerAddress}.`);
    }
    if (scoreMicros > 0n) addToMap(scoreByWallet, ownerAddress, scoreMicros);

    for (const planet of planets) {
      const collection = collectionResults.get(planet.id);
      const upgradeBonusBps = upgradeBonusBpsAt(purchases, planet.id, cutoff.getTime());
      addToMap(
        rateByWallet,
        ownerAddress,
        calculateEffectiveMineralsPerDayMicros(
          planet.baseMineralsPerDay,
          (collection?.collectionBonusBps ?? 0) + upgradeBonusBps,
        ),
      );
    }
  }

  return rankLeaderboardRows(
    [...scoreByWallet].map(([walletAddress, scoreMicros]) => ({
      walletAddress,
      scoreMicros,
      effectiveMineralsPerDayMicros: rateByWallet.get(walletAddress) ?? 0n,
    })),
  );
}

export function paginateLeaderboardRows(
  rows: readonly RankedLeaderboardRow[],
  pagination: Pagination,
) {
  return {
    total: rows.length,
    offset: pagination.offset,
    limit: pagination.limit,
    rows: rows.slice(pagination.offset, pagination.offset + pagination.limit),
  };
}

export async function getCurrentLeaderboard(
  prisma: PrismaClient,
  now: Date,
  pagination: Pagination,
  options: LeaderboardEconomyOptions = {},
) {
  const snapshot = await getLiveLeaderboardSnapshot(prisma, now, options);
  return {
    period: getLeaderboardPeriod(snapshot.asOf),
    asOf: snapshot.asOf,
    ...paginateLeaderboardRows(snapshot.rows, pagination),
  };
}

export async function getWalletLeaderboardPosition(
  prisma: PrismaClient,
  walletAddress: string,
  now: Date,
  options: LeaderboardEconomyOptions = {},
) {
  const snapshot = await getLiveLeaderboardSnapshot(prisma, now, options);
  const normalizedAddress = walletAddress.toLowerCase();
  const row = snapshot.rows.find((entry) => entry.walletAddress === normalizedAddress);
  return {
    period: getLeaderboardPeriod(snapshot.asOf),
    asOf: snapshot.asOf,
    row,
    distanceToNextRankMicros: row ? getDistanceToNextRank(snapshot.rows, normalizedAddress) : null,
  };
}

async function getLiveLeaderboardSnapshot(
  prisma: PrismaClient,
  now: Date,
  options: LeaderboardEconomyOptions,
): Promise<LiveLeaderboardSnapshot> {
  const resolution = await resolveMineralEconomyCutover(
    prisma,
    options.mineralEconomyCutoverAt,
  );
  const cutoverAt = resolution.cutoverAt;
  if (!cutoverAt) {
    const planets = await prisma.backendPlanet.findMany({
      where: { status: 'READY', baseMineralsPerDay: { gt: 0n } },
      select: { id: true, ownerAddress: true, planetType: true, baseMineralsPerDay: true, generatedAt: true },
    });
    return { asOf: now, rows: calculateLiveLeaderboardRows({ asOf: now, planets }) };
  }

  return prisma.$transaction(
    async (transaction) => {
      const asOf = typeof transaction.$queryRaw === 'function'
        ? await getPostgresClockTimestamp(transaction)
        : now;
      const planets = await transaction.backendPlanet.findMany({
        where: { status: 'READY', baseMineralsPerDay: { gt: 0n }, generatedAt: { lte: asOf } },
        select: { id: true, ownerAddress: true, planetType: true, baseMineralsPerDay: true, generatedAt: true },
      });
      if (asOf < cutoverAt) {
        return { asOf, rows: calculateLiveLeaderboardRows({ asOf, planets }) };
      }
      const [accounts, purchases] = await Promise.all([
        transaction.mineralAccount.findMany({
          select: { ownerAddress: true, openingBalanceMicros: true },
        }),
        transaction.planetUpgradePurchase.findMany({
          where: { purchasedAt: { lte: asOf } },
          orderBy: [{ purchasedAt: 'asc' }, { id: 'asc' }],
          select: {
            planetId: true,
            walletAddress: true,
            targetLevel: true,
            bonusBpsAfter: true,
            costMicros: true,
            purchasedAt: true,
          },
        }),
      ]);
      return {
        asOf,
        rows: calculatePostCutoverLeaderboardRows({
          asOf,
          cutoverAt,
          includeEventsAtAsOf: true,
          accounts,
          planets,
          purchases,
        }),
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}

async function lockLeaderboardFinalization(transaction: Prisma.TransactionClient): Promise<void> {
  if (typeof transaction.$queryRaw !== 'function') return;
  await acquireMineralEconomyExclusiveBarrier(transaction);
}

type FinalizationRead = {
  postCutover: boolean;
  planets: unknown[];
  accounts?: unknown[];
  purchases?: unknown[];
};

async function readFinalizationData(
  transaction: Prisma.TransactionClient,
  period: LeaderboardPeriodBounds,
  postCutover: boolean,
): Promise<FinalizationRead> {
  const backendPlanet = (transaction as typeof transaction & {
    backendPlanet?: { findMany: (args: unknown) => Promise<unknown[]> };
  }).backendPlanet;
  const planets = backendPlanet
    ? await backendPlanet.findMany({
        where: { status: 'READY', baseMineralsPerDay: { gt: 0n }, generatedAt: { lt: period.endsAt } },
        select: { id: true, ownerAddress: true, planetType: true, baseMineralsPerDay: true, generatedAt: true },
      })
    : await transaction.planet.findMany({
        where: {
          ownerAddress: { not: ZERO_ADDRESS },
          baseMineralsPerDay: { not: null },
          mintedAt: { lt: period.endsAt },
        },
        select: { id: true, ownerAddress: true, planetType: true, baseMineralsPerDay: true, mintedAt: true },
      });
  if (!postCutover) return { postCutover, planets };

  const accountModel = (transaction as typeof transaction & {
    mineralAccount?: { findMany: (args: unknown) => Promise<unknown[]> };
  }).mineralAccount;
  const purchaseModel = (transaction as typeof transaction & {
    planetUpgradePurchase?: { findMany: (args: unknown) => Promise<unknown[]> };
  }).planetUpgradePurchase;
  if (!accountModel || !purchaseModel)
    throw new Error('Post-cutover leaderboard models are unavailable.');
  const [accounts, purchases] = await Promise.all([
    accountModel.findMany({ select: { ownerAddress: true, openingBalanceMicros: true } }),
    purchaseModel.findMany({
      where: { purchasedAt: { lt: period.endsAt } },
      orderBy: [{ purchasedAt: 'asc' }, { id: 'asc' }],
      select: {
        planetId: true,
        walletAddress: true,
        targetLevel: true,
        bonusBpsAfter: true,
        costMicros: true,
        purchasedAt: true,
      },
    }),
  ]);
  return { postCutover, planets, accounts, purchases };
}

function rowsForFinalization(
  data: FinalizationRead,
  period: LeaderboardPeriodBounds,
  cutoverAt: Date | null | undefined,
): RankedLeaderboardRow[] {
  if (data.postCutover && cutoverAt) {
    return calculatePostCutoverLeaderboardRows({
      period,
      asOf: period.endsAt,
      cutoverAt,
      planets: data.planets as SpendableLeaderboardPlanet[],
      accounts: data.accounts as SpendableLeaderboardAccount[],
      purchases: data.purchases as SpendableLeaderboardPurchase[],
    });
  }
  return calculateLeaderboardRows({
    period,
    asOf: period.endsAt,
    planets: data.planets.map((planet) => ({
      id: (planet as { id: string }).id,
      ownerAddress: (planet as { ownerAddress: string }).ownerAddress,
      baseMineralsPerDay: (planet as { baseMineralsPerDay: bigint | null }).baseMineralsPerDay,
      planetType: (planet as { planetType?: string | null }).planetType,
      mintedAt:
        (planet as { generatedAt?: Date; mintedAt?: Date }).generatedAt ??
        (planet as { mintedAt: Date }).mintedAt,
    })),
  });
}

export async function finalizeLeaderboardPeriod(
  prisma: PrismaClient,
  period: LeaderboardPeriodBounds,
  _finalizedAt: Date,
  options: LeaderboardEconomyOptions = {},
) {
  return prisma.$transaction(async (transaction) => {
    await lockLeaderboardFinalization(transaction);
    const databaseNow = await getPostgresClockTimestamp(transaction);
    if (databaseNow < period.endsAt) {
      throw new Error('Leaderboard period has not ended in PostgreSQL.');
    }
    const resolution = await resolveMineralEconomyCutover(
      transaction,
      options.mineralEconomyCutoverAt,
    );
    const cutoverAt = resolution.cutoverAt;
    const postCutover = !!cutoverAt && period.startsAt >= cutoverAt;
    const existing = await transaction.leaderboardPeriod.findUnique({ where: { id: period.id } });
    if (existing?.finalizedAt) {
      return transaction.leaderboardEntry.findMany({
        where: { periodId: period.id },
        orderBy: { rank: 'asc' },
      });
    }
    const data = await readFinalizationData(transaction, period, postCutover);
    const rows = rowsForFinalization(data, period, cutoverAt);
    await transaction.leaderboardPeriod.upsert({
      where: { id: period.id },
      create: { id: period.id, startsAt: period.startsAt, endsAt: period.endsAt, finalizedAt: databaseNow },
      update: { finalizedAt: databaseNow },
    });
    if (rows.length > 0) {
      await transaction.leaderboardEntry.createMany({
        data: rows.map((row) => ({
          periodId: period.id,
          walletAddress: row.walletAddress,
          scoreMicros: row.scoreMicros,
          effectiveMineralsPerDayMicros: row.effectiveMineralsPerDayMicros,
          rank: row.rank,
        })),
        skipDuplicates: true,
      });
    }
    return transaction.leaderboardEntry.findMany({
      where: { periodId: period.id },
      orderBy: { rank: 'asc' },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}

/** Finalizes every completed UTC day in chronological order. */
export async function ensureOverdueLeaderboardPeriodsFinalized(
  prisma: PrismaClient,
  now: Date,
  options: LeaderboardEconomyOptions = {},
): Promise<void> {
  const effectiveNow = typeof prisma.$queryRaw === 'function'
    ? await getPostgresClockTimestamp(prisma)
    : now;
  const cutoverAt = options.mineralEconomyCutoverAt;
  if (cutoverAt && !Number.isFinite(cutoverAt.getTime()))
    throw new Error('Mineral economy cutover timestamp is invalid.');
  const backendPlanet = (prisma as typeof prisma & {
    backendPlanet?: {
      findFirst: (args: unknown) => Promise<{ generatedAt: Date } | null>;
    };
  }).backendPlanet;
  const [latest, earliestPlanet] = await Promise.all([
    prisma.leaderboardPeriod.findFirst({
      where: { finalizedAt: { not: null }, endsAt: { lte: effectiveNow } },
      orderBy: { endsAt: 'desc' },
      select: { endsAt: true },
    }),
    backendPlanet
      ? backendPlanet.findFirst({
          where: { status: 'READY', baseMineralsPerDay: { gt: 0n } },
          orderBy: { generatedAt: 'asc' },
          select: { generatedAt: true },
        })
      : prisma.planet.findFirst({
          where: { baseMineralsPerDay: { not: null } },
          orderBy: { mintedAt: 'asc' },
          select: { mintedAt: true },
        }),
  ]);
  if (!latest && !earliestPlanet) return;

  const earliestTime = earliestPlanet
    ? 'generatedAt' in earliestPlanet
      ? earliestPlanet.generatedAt
      : earliestPlanet.mintedAt
    : undefined;
  let period = getLeaderboardPeriod(latest?.endsAt ?? earliestTime ?? effectiveNow);
  let finalizedPeriods = 0;
  while (period.endsAt <= effectiveNow) {
    await finalizeLeaderboardPeriod(prisma, period, effectiveNow, { mineralEconomyCutoverAt: cutoverAt });
    period = getLeaderboardPeriod(period.endsAt);
    finalizedPeriods += 1;
    if (finalizedPeriods > 3_660)
      throw new Error('Leaderboard finalization backlog exceeds ten years.');
  }
}

export async function listLeaderboardPeriods(prisma: PrismaClient, pagination: Pagination) {
  const [total, periods] = await Promise.all([
    prisma.leaderboardPeriod.count({ where: { finalizedAt: { not: null } } }),
    prisma.leaderboardPeriod.findMany({
      where: { finalizedAt: { not: null } },
      orderBy: { startsAt: 'desc' },
      skip: pagination.offset,
      take: pagination.limit,
    }),
  ]);
  return { total, offset: pagination.offset, limit: pagination.limit, periods };
}

export async function getArchivedLeaderboard(
  prisma: PrismaClient,
  periodId: string,
  pagination: Pagination,
) {
  const period = await prisma.leaderboardPeriod.findUnique({ where: { id: periodId } });
  if (!period?.finalizedAt) return undefined;
  const [total, rows] = await Promise.all([
    prisma.leaderboardEntry.count({ where: { periodId } }),
    prisma.leaderboardEntry.findMany({
      where: { periodId },
      orderBy: { rank: 'asc' },
      skip: pagination.offset,
      take: pagination.limit,
    }),
  ]);
  return { period, total, offset: pagination.offset, limit: pagination.limit, rows };
}
