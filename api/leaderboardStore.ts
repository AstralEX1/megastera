import type { PrismaClient } from './generated/prisma/client';
import { calculateCollectionMining, type CollectionMiningPlanet } from './collectionMining';
import {
  getDistanceToNextRank,
  getLeaderboardPeriod,
  type LeaderboardPeriodBounds,
  type RankedLeaderboardRow,
  rankLeaderboardRows,
} from './leaderboard';
import { calculateLifetimeMinerals, MINERAL_SCALE } from './mining';

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

export const LIVE_LEADERBOARD_CACHE_TTL_MS = 60_000;

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

type LiveCacheEntry<T> = { expiresAt: number; value: T };

/** Small async-safe TTL cache used to keep live standings affordable under refresh. */
export function createLiveLeaderboardCache<T = LiveLeaderboardSnapshot>(
  ttlMs = LIVE_LEADERBOARD_CACHE_TTL_MS,
) {
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) throw new RangeError('Leaderboard cache TTL must be positive.');
  let entry: LiveCacheEntry<T> | undefined;
  let pending: Promise<T> | undefined;

  return {
    async get(now: Date, loader: (asOf: Date) => Promise<T> | T): Promise<T> {
      if (entry && now.getTime() < entry.expiresAt) return entry.value;
      if (pending) return pending;
      pending = Promise.resolve(loader(now)).then((value) => {
        entry = { expiresAt: now.getTime() + ttlMs, value };
        return value;
      }).finally(() => {
        pending = undefined;
      });
      return pending;
    },
    clear() {
      entry = undefined;
    },
  };
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
) {
  const snapshot = await getLiveLeaderboardSnapshot(prisma, now);
  return {
    period: getLeaderboardPeriod(now),
    asOf: snapshot.asOf,
    ...paginateLeaderboardRows(snapshot.rows, pagination),
  };
}

export async function getWalletLeaderboardPosition(
  prisma: PrismaClient,
  walletAddress: string,
  now: Date,
) {
  const snapshot = await getLiveLeaderboardSnapshot(prisma, now);
  const normalizedAddress = walletAddress.toLowerCase();
  const row = snapshot.rows.find((entry) => entry.walletAddress === normalizedAddress);
  return {
    period: getLeaderboardPeriod(now),
    asOf: snapshot.asOf,
    row,
    distanceToNextRankMicros: row ? getDistanceToNextRank(snapshot.rows, normalizedAddress) : null,
  };
}

const liveLeaderboardCaches = new WeakMap<object, ReturnType<typeof createLiveLeaderboardCache<LiveLeaderboardSnapshot>>>();

function getLiveLeaderboardCache(prisma: PrismaClient) {
  const key = prisma as unknown as object;
  const current = liveLeaderboardCaches.get(key);
  if (current) return current;
  const created = createLiveLeaderboardCache<LiveLeaderboardSnapshot>();
  liveLeaderboardCaches.set(key, created);
  return created;
}

async function getLiveLeaderboardSnapshot(
  prisma: PrismaClient,
  now: Date,
): Promise<LiveLeaderboardSnapshot> {
  return getLiveLeaderboardCache(prisma).get(now, async (asOf) => {
    const planets = await prisma.backendPlanet.findMany({
      where: { status: 'READY', baseMineralsPerDay: { gt: 0n } },
      select: { id: true, ownerAddress: true, planetType: true, baseMineralsPerDay: true, generatedAt: true },
    });
    return {
      asOf,
      rows: calculateLiveLeaderboardRows({ asOf, planets }),
    };
  });
}

export async function finalizeLeaderboardPeriod(
  prisma: PrismaClient,
  period: LeaderboardPeriodBounds,
  finalizedAt: Date,
) {
  return prisma.$transaction(async (transaction) => {
    const transactionWithQueryRaw = transaction as typeof transaction & {
      $queryRaw?: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;
    };
    if (transactionWithQueryRaw.$queryRaw) {
      // pg_advisory_xact_lock returns PostgreSQL's `void` type. Selecting that
      // value directly makes Prisma fail while decoding the raw query result;
      // keep the transaction-scoped lock but expose only a scalar column.
      await transactionWithQueryRaw.$queryRaw`SELECT 1 AS locked
        FROM (
          SELECT pg_advisory_xact_lock(hashtextextended('megaplanets:leaderboard-finalization', 0)) AS acquired
        ) AS lock_result`;
    }
    const existing = await transaction.leaderboardPeriod.findUnique({ where: { id: period.id } });
    if (existing?.finalizedAt) {
      return transaction.leaderboardEntry.findMany({
        where: { periodId: period.id },
        orderBy: { rank: 'asc' },
      });
    }

    const backendPlanet = (transaction as typeof transaction & {
      backendPlanet?: {
        findMany: (args: unknown) => Promise<unknown[]>;
      };
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
    const rows = calculateLeaderboardRows({
      period,
      asOf: period.endsAt,
      planets: planets.map((planet) => ({
        id: (planet as { id: string }).id,
        ownerAddress: (planet as { ownerAddress: string }).ownerAddress,
        baseMineralsPerDay: (planet as { baseMineralsPerDay: bigint | null }).baseMineralsPerDay,
        planetType: (planet as { planetType?: string | null }).planetType,
        mintedAt: (planet as { generatedAt?: Date; mintedAt?: Date }).generatedAt ?? (planet as { mintedAt: Date }).mintedAt,
      })),
    });
    await transaction.leaderboardPeriod.upsert({
      where: { id: period.id },
      create: { id: period.id, startsAt: period.startsAt, endsAt: period.endsAt, finalizedAt },
      update: { finalizedAt },
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
  });
}

/** Finalizes every completed UTC day in chronological order. */
export async function ensureOverdueLeaderboardPeriodsFinalized(
  prisma: PrismaClient,
  now: Date,
): Promise<void> {
  const backendPlanet = (prisma as typeof prisma & {
    backendPlanet?: {
      findFirst: (args: unknown) => Promise<{ generatedAt: Date } | null>;
    };
  }).backendPlanet;
  const [latest, earliestPlanet] = await Promise.all([
    prisma.leaderboardPeriod.findFirst({
      where: { finalizedAt: { not: null }, endsAt: { lte: now } },
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
  let period = getLeaderboardPeriod(latest?.endsAt ?? earliestTime ?? now);
  let finalizedPeriods = 0;
  while (period.endsAt <= now) {
    await finalizeLeaderboardPeriod(prisma, period, now);
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
