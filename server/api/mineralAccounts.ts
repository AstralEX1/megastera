import { type CollectionMiningPlanet, calculateCollectionMining } from './collectionMining.js';
import {
  calculateHistoricalProduction,
  type GalaxyPulseMiningRound,
  type MineralCollectionPlanet,
  type MineralUpgradePurchase,
} from './mineralEconomy.js';
import { loadGalaxyPulseRounds } from './galaxyPulseStore.js';
import { calculateUpgradeCostMicros, getMineralUpgradeConfig } from './mineralUpgrades.js';
import { Prisma, type PrismaClient } from './generated/prisma/client.js';

export type MineralAccountPlanet = CollectionMiningPlanet;

type MineralAccountPlanetRow = {
  id: string;
  ownerAddress: string;
  planetType: string;
  baseMineralsPerDay: bigint;
  generatedAt: Date;
};

export type MineralSettlementPlanet = MineralCollectionPlanet & {
  upgradeLevel: number;
  upgradeBonusBps: number;
};

export type MineralSettlementPurchase = MineralUpgradePurchase & {
  targetLevel?: number;
};

function assertCutover(cutoverAt: Date): void {
  if (!Number.isFinite(cutoverAt.getTime()))
    throw new Error('Mineral economy cutover timestamp is invalid.');
}

type MineralEconomyCutoverRow = { id: number; cutoverAt: Date };
type MineralEconomyCutoverStore = {
  findUnique(args: { where: { id: number } }): Promise<MineralEconomyCutoverRow | null>;
  create?(args: { data: MineralEconomyCutoverRow }): Promise<MineralEconomyCutoverRow>;
  createMany?(args: { data: MineralEconomyCutoverRow[]; skipDuplicates?: boolean }): Promise<{ count: number }>;
};
type MineralEconomyCutoverClient = {
  mineralEconomyCutover?: MineralEconomyCutoverStore;
};
type PostgresClockClient = Pick<Prisma.TransactionClient, '$queryRaw'>;

export type MineralEconomyCutoverResolution =
  | { state: 'V1'; cutoverAt: null; source: 'none' }
  | { state: 'STAGED_V2'; cutoverAt: Date; source: 'config' }
  | { state: 'V2'; cutoverAt: Date; source: 'database' | 'config+database' };

export async function getPostgresClockTimestamp(prisma: PostgresClockClient): Promise<Date> {
  const rows = await prisma.$queryRaw<Array<{ now: Date }>>(
    Prisma.sql`SELECT clock_timestamp()::timestamptz(3) AS "now"`,
  );
  const value = rows[0]?.now;
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new Error('PostgreSQL clock timestamp is invalid.');
  }
  return value;
}

export async function readMineralEconomyCutover(
  prisma: MineralEconomyCutoverClient,
): Promise<Date | null> {
  const model = prisma.mineralEconomyCutover;
  if (!model) return null;
  const row = await model.findUnique({ where: { id: 1 } });
  return row?.cutoverAt ?? null;
}

/** Resolves rollout state without creating or updating any database row. */
export async function resolveMineralEconomyCutover(
  prisma: MineralEconomyCutoverClient,
  configuredCutoverAt: Date | null | undefined,
): Promise<MineralEconomyCutoverResolution> {
  if (configuredCutoverAt) assertCutover(configuredCutoverAt);
  const persistedCutoverAt = await readMineralEconomyCutover(prisma);
  if (persistedCutoverAt) assertCutover(persistedCutoverAt);
  if (!persistedCutoverAt && !configuredCutoverAt) {
    return { state: 'V1', cutoverAt: null, source: 'none' };
  }
  if (
    persistedCutoverAt &&
    configuredCutoverAt &&
    persistedCutoverAt.getTime() !== configuredCutoverAt.getTime()
  ) {
    throw new Error('Configured mineral economy cutover conflicts with the persisted database cutover.');
  }
  if (persistedCutoverAt) {
    return {
      state: 'V2',
      cutoverAt: persistedCutoverAt,
      source: configuredCutoverAt ? 'config+database' : 'database',
    };
  }
  return { state: 'STAGED_V2', cutoverAt: configuredCutoverAt as Date, source: 'config' };
}

type MineralEconomyOperationClient = MineralEconomyCutoverClient &
  Partial<PostgresClockClient>;

/** Resolves a caller's state and rejects an unpersisted cutover after PostgreSQL reaches T. */
export async function resolveMineralEconomyForOperation(
  prisma: MineralEconomyOperationClient,
  configuredCutoverAt: Date | null | undefined,
  databaseNow?: Date,
): Promise<MineralEconomyCutoverResolution> {
  const resolution = await resolveMineralEconomyCutover(prisma, configuredCutoverAt);
  if (resolution.state !== 'STAGED_V2') return resolution;
  // Narrow unit-only Prisma doubles may omit the cutover model; production clients always expose it.
  if (!prisma.mineralEconomyCutover) return resolution;
  const now = databaseNow ?? (
    typeof prisma.$queryRaw === 'function'
      ? await getPostgresClockTimestamp(prisma as PostgresClockClient)
      : null
  );
  if (now && now >= resolution.cutoverAt) {
    throw new Error('configured mineral economy cutover is not persisted before PostgreSQL reached it.');
  }
  return resolution;
}

type EconomyBarrierClient = Pick<Prisma.TransactionClient, '$queryRaw'>;

/** Shared transaction-scoped lock for generation and upgrade mutations. */
export async function acquireMineralEconomySharedBarrier(
  prisma: EconomyBarrierClient,
): Promise<void> {
  await prisma.$queryRaw<Array<{ locked: number }>>`SELECT 1 AS locked
    FROM (
      SELECT pg_advisory_xact_lock_shared(hashtextextended('megaplanets:mineral-economy', 0)) AS acquired
    ) AS lock_result`;
}

/** Exclusive transaction-scoped lock for finalization, backfill, and preparation. */
export async function acquireMineralEconomyExclusiveBarrier(
  prisma: EconomyBarrierClient,
): Promise<void> {
  await prisma.$queryRaw<Array<{ locked: number }>>`SELECT 1 AS locked
    FROM (
      SELECT pg_advisory_xact_lock(hashtextextended('megaplanets:mineral-economy', 0)) AS acquired
    ) AS lock_result`;
}

/** Serializes all economic mutations for one wallet after the shared barrier. */
export async function acquireMineralWalletLock(
  prisma: EconomyBarrierClient,
  ownerAddress: string,
): Promise<void> {
  await prisma.$queryRaw<Array<{ locked: number }>>`SELECT 1 AS locked
    FROM (
      SELECT pg_advisory_xact_lock(
        hashtextextended('megaplanets:mineral-wallet:' || ${normalizeOwner(ownerAddress)}, 0)
      ) AS acquired
    ) AS lock_result`;
}

export const lockMineralEconomyShared = acquireMineralEconomySharedBarrier;
export const lockMineralEconomyExclusive = acquireMineralEconomyExclusiveBarrier;

/** Deliberately persists a future cutover; ordinary reads and mutations never do this. */
export async function prepareMineralEconomyCutover(
  prisma: PrismaClient,
  cutoverAt: Date,
): Promise<MineralEconomyCutoverRow> {
  assertCutover(cutoverAt);
  return prisma.$transaction(async (transaction) => {
    await acquireMineralEconomyExclusiveBarrier(transaction);
    const databaseNow = await getPostgresClockTimestamp(transaction);
    if (cutoverAt <= databaseNow) {
      throw new Error('Mineral economy cutover must be in the future of PostgreSQL time.');
    }
    const model = (transaction as unknown as MineralEconomyCutoverClient).mineralEconomyCutover;
    if (!model) throw new Error('Mineral economy cutover model is unavailable.');
    const existing = await model.findUnique({ where: { id: 1 } });
    if (existing && existing.cutoverAt.getTime() !== cutoverAt.getTime()) {
      throw new Error('Configured mineral economy cutover conflicts with the persisted database cutover.');
    }
    if (existing) return existing;
    if (model.create) return model.create({ data: { id: 1, cutoverAt } });
    if (model.createMany) {
      await model.createMany({ data: [{ id: 1, cutoverAt }], skipDuplicates: true });
      const persisted = await model.findUnique({ where: { id: 1 } });
      if (persisted) return persisted;
    }
    throw new Error('Mineral economy cutover could not be persisted.');
  });
}

/** Creates the immutable singleton on first use and rejects a configured conflict. */
export async function ensureMineralEconomyCutover(
  prisma: MineralEconomyCutoverClient,
  cutoverAt: Date | null | undefined,
) {
  if (!cutoverAt) return null;
  assertCutover(cutoverAt);
  const model = prisma.mineralEconomyCutover;
  if (!model?.createMany) throw new Error('Mineral economy cutover model is unavailable.');
  await model.createMany({
    data: [{ id: 1, cutoverAt }],
    skipDuplicates: true,
  });
  const persisted = await model.findUnique({ where: { id: 1 } });
  if (!persisted) throw new Error('Mineral economy cutover could not be persisted.');
  if (persisted.cutoverAt.getTime() !== cutoverAt.getTime()) {
    throw new Error('Configured mineral economy cutover conflicts with the persisted database cutover.');
  }
  return persisted;
}

/**
 * Uses the existing V1 collection calculator unchanged for the cutover snapshot.
 * This is intentionally separate from v2 temporal settlement math.
 */
export function calculateV1WalletOpeningBalance(
  planets: readonly MineralAccountPlanet[],
  cutoverAt: Date,
): bigint {
  assertCutover(cutoverAt);
  const results = calculateCollectionMining({ planets, asOf: cutoverAt });
  let total = 0n;
  for (const result of results.values()) total += result.earnedMicros;
  return total;
}

export function calculateCurrentMineralBalanceMicros(input: {
  account: { balanceMicros: bigint; lastSettledAt: Date } | null | undefined;
  openingBalanceMicros: bigint;
  cutoverAt: Date;
  asOf: Date;
  planets: readonly MineralCollectionPlanet[];
  purchases: readonly MineralUpgradePurchase[];
  pulseRounds?: readonly GalaxyPulseMiningRound[];
}): bigint {
  assertCutover(input.cutoverAt);
  assertTimestamp(input.asOf, 'Current balance');
  if (input.asOf < input.cutoverAt) {
    throw new Error('Current balance timestamp cannot be before mineral economy cutover.');
  }
  if (!input.account && input.purchases.length > 0) {
    throw new Error('Current balance cannot use spending history without a MineralAccount.');
  }
  const from = input.account?.lastSettledAt ?? input.cutoverAt;
  assertTimestamp(from, 'Account settlement');
  if (from < input.cutoverAt) {
    throw new Error('Account settlement timestamp cannot be before mineral economy cutover.');
  }
  const producedMicros = calculateHistoricalProduction({
    planets: input.planets,
    purchases: input.purchases,
    from,
    to: input.asOf,
    anchor: input.cutoverAt,
    pulseRounds: input.pulseRounds,
  });
  const balanceMicros = (input.account?.balanceMicros ?? input.openingBalanceMicros) + producedMicros;
  if (balanceMicros < 0n) throw new Error('Mineral balance cannot be negative.');
  return balanceMicros;
}

export type MineralAccountInitializationResult = {
  candidateCount: number;
  createdCount: number;
};

/** Creates missing accounts from one bounded Planet read; existing rows are never updated. */
export async function initializeMineralAccounts(
  prisma: PrismaClient,
  cutoverAt: Date | null | undefined,
): Promise<MineralAccountInitializationResult> {
  if (!cutoverAt) return { candidateCount: 0, createdCount: 0 };
  assertCutover(cutoverAt);
  await resolveMineralEconomyForOperation(prisma, cutoverAt);
  const planets = (await prisma.backendPlanet.findMany({
    where: { status: 'READY', generatedAt: { lte: cutoverAt } },
    select: {
      id: true,
      ownerAddress: true,
      planetType: true,
      baseMineralsPerDay: true,
      generatedAt: true,
    },
  })) as MineralAccountPlanetRow[];
  const byOwner = new Map<string, MineralAccountPlanet[]>();
  for (const planet of planets) {
    const ownerAddress = planet.ownerAddress.toLowerCase();
    const ownerPlanets = byOwner.get(ownerAddress) ?? [];
    ownerPlanets.push({ ...planet, ownerAddress });
    byOwner.set(ownerAddress, ownerPlanets);
  }

  const data = [...byOwner.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([ownerAddress, ownerPlanets]) => {
      const openingBalanceMicros = calculateV1WalletOpeningBalance(ownerPlanets, cutoverAt);
      return {
        ownerAddress,
        openingBalanceMicros,
        balanceMicros: openingBalanceMicros,
        lastSettledAt: cutoverAt,
      };
    });
  if (data.length === 0) return { candidateCount: 0, createdCount: 0 };
  const created = await prisma.mineralAccount.createMany({ data, skipDuplicates: true });
  return { candidateCount: data.length, createdCount: created.count };
}

type MineralBackfillRow = {
  ownerAddress: string;
  openingBalanceMicros: bigint;
};

type MineralBackfillAccount = {
  ownerAddress: string;
  openingBalanceMicros: bigint;
};

export type MineralAccountsBackfillResult = {
  cutoverAt: Date;
  candidateCount: number;
  existingCount: number;
  missingCount: number;
  openingBalanceMicros: bigint;
  missingOpeningBalanceMicros: bigint;
  createdCount: number;
};

async function loadMineralBackfillRows(
  prisma: PrismaClient | Prisma.TransactionClient,
  cutoverAt: Date,
): Promise<{ rows: MineralBackfillRow[]; existing: Map<string, MineralBackfillAccount> }> {
  const planets = (await prisma.backendPlanet.findMany({
    where: { status: 'READY', generatedAt: { lte: cutoverAt } },
    select: {
      id: true,
      ownerAddress: true,
      planetType: true,
      baseMineralsPerDay: true,
      generatedAt: true,
    },
  })) as MineralAccountPlanetRow[];
  const byOwner = new Map<string, MineralAccountPlanet[]>();
  for (const planet of planets) {
    const ownerAddress = planet.ownerAddress.toLowerCase();
    const ownerPlanets = byOwner.get(ownerAddress) ?? [];
    ownerPlanets.push({ ...planet, ownerAddress });
    byOwner.set(ownerAddress, ownerPlanets);
  }
  const rows = [...byOwner.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([ownerAddress, ownerPlanets]) => ({
      ownerAddress,
      openingBalanceMicros: calculateV1WalletOpeningBalance(ownerPlanets, cutoverAt),
    }));
  const accountModel = (prisma as PrismaClient & {
    mineralAccount?: {
      findMany: (args: unknown) => Promise<MineralBackfillAccount[]>;
    };
  }).mineralAccount;
  const existing = accountModel
    ? await accountModel.findMany({
        select: { ownerAddress: true, openingBalanceMicros: true },
      })
    : [];
  return {
    rows,
    existing: new Map(
      existing.map((row) => [row.ownerAddress.toLowerCase(), row] as const),
    ),
  };
}

export async function runMineralAccountsBackfill(
  prisma: PrismaClient,
  cutoverAt: Date | null | undefined,
  options: { dryRun?: boolean } = {},
): Promise<MineralAccountsBackfillResult> {
  if (!cutoverAt) throw new Error('MINERAL_ECONOMY_CUTOVER_AT is required for mineral backfill.');
  assertCutover(cutoverAt);
  if (options.dryRun) {
    await resolveMineralEconomyForOperation(prisma, cutoverAt);
    const { rows, existing } = await loadMineralBackfillRows(prisma, cutoverAt);
    return buildMineralBackfillResult(cutoverAt, rows, existing);
  }

  return prisma.$transaction(async (transaction) => {
    await acquireMineralEconomyExclusiveBarrier(transaction);
    const databaseNow = await getPostgresClockTimestamp(transaction);
    if (databaseNow < cutoverAt) {
      throw new Error('Mineral backfill cannot run before the configured cutover in PostgreSQL.');
    }

    const resolution = await resolveMineralEconomyForOperation(transaction, cutoverAt, databaseNow);
    if (resolution.cutoverAt?.getTime() !== cutoverAt.getTime()) {
      throw new Error('Configured mineral economy cutover conflicts with the persisted database cutover.');
    }
    const { rows, existing } = await loadMineralBackfillRows(transaction, cutoverAt);
    const expectedByOwner = new Map(rows.map((row) => [row.ownerAddress, row.openingBalanceMicros]));
    for (const [ownerAddress, account] of existing) {
      const expected = expectedByOwner.get(ownerAddress) ?? 0n;
      if (account.openingBalanceMicros !== expected) {
        throw new Error(`Mineral account ${ownerAddress} opening balance does not match V1.`);
      }
    }
    const leaderboardPeriod = (transaction as Prisma.TransactionClient & {
      leaderboardPeriod?: { findFirst: (args: unknown) => Promise<{ id: string } | null> };
    }).leaderboardPeriod;
    const finalizedPostCutover = leaderboardPeriod
      ? await leaderboardPeriod.findFirst({
          where: { startsAt: { gte: cutoverAt }, finalizedAt: { not: null } },
          select: { id: true },
        })
      : null;
    if (finalizedPostCutover) {
      throw new Error('Mineral backfill cannot run after a finalized post-cutover leaderboard period.');
    }
    const result = buildMineralBackfillResult(cutoverAt, rows, existing);
    const missing = rows.filter((row) => !existing.has(row.ownerAddress));
    const created = await transaction.mineralAccount.createMany({
      data: missing.map((row) => ({
        ownerAddress: row.ownerAddress,
        openingBalanceMicros: row.openingBalanceMicros,
        balanceMicros: row.openingBalanceMicros,
        lastSettledAt: cutoverAt,
      })),
      skipDuplicates: true,
    });
    return { ...result, createdCount: created.count };
  });
}

function buildMineralBackfillResult(
  cutoverAt: Date,
  rows: readonly MineralBackfillRow[],
  existing: ReadonlyMap<string, MineralBackfillAccount>,
): MineralAccountsBackfillResult {
  const missing = rows.filter((row) => !existing.has(row.ownerAddress));
  return {
    cutoverAt,
    candidateCount: rows.length,
    existingCount: rows.length - missing.length,
    missingCount: missing.length,
    openingBalanceMicros: rows.reduce((total, row) => total + row.openingBalanceMicros, 0n),
    missingOpeningBalanceMicros: missing.reduce(
      (total, row) => total + row.openingBalanceMicros,
      0n,
    ),
    createdCount: 0,
  };
}

export const backfillMineralAccounts = runMineralAccountsBackfill;

function normalizeOwner(ownerAddress: string): string {
  return ownerAddress.toLowerCase();
}

function assertTimestamp(value: Date, name: string): void {
  if (!Number.isFinite(value.getTime())) throw new Error(`${name} timestamp is invalid.`);
}

export async function settleMineralAccount(input: {
  prisma: Prisma.TransactionClient;
  account: {
    ownerAddress: string;
    balanceMicros: bigint;
    lastSettledAt: Date;
  };
  planets: readonly MineralSettlementPlanet[];
  purchases: readonly MineralSettlementPurchase[];
  pulseRounds?: readonly GalaxyPulseMiningRound[];
  settledAt: Date;
  anchor: Date;
}) {
  assertTimestamp(input.settledAt, 'Settlement');
  assertTimestamp(input.account.lastSettledAt, 'Account settlement');
  if (input.settledAt < input.account.lastSettledAt) {
    throw new Error('Settlement timestamp cannot move backwards.');
  }
  const pulseRounds = input.pulseRounds ?? (input.prisma.galaxyPulseRound
    ? await loadGalaxyPulseRounds(input.prisma, input.settledAt)
    : []);
  const producedMicros = calculateHistoricalProduction({
    planets: input.planets,
    purchases: input.purchases,
    from: input.account.lastSettledAt,
    to: input.settledAt,
    anchor: input.anchor,
    pulseRounds,
  });
  if (producedMicros === 0n && input.settledAt.getTime() === input.account.lastSettledAt.getTime()) {
    return { ...input.account, balanceMicros: input.account.balanceMicros };
  }
  const balanceMicros = input.account.balanceMicros + producedMicros;
  if (balanceMicros < 0n) throw new Error('Mineral balance cannot be negative.');
  const updated = await input.prisma.mineralAccount.update({
    where: { ownerAddress: normalizeOwner(input.account.ownerAddress) },
    data: { balanceMicros, lastSettledAt: input.settledAt },
  });
  return updated;
}

export async function ensureAndLockMineralAccount(
  prisma: Prisma.TransactionClient,
  ownerAddress: string,
  cutoverAt: Date,
) {
  const owner = normalizeOwner(ownerAddress);
  const existing = await prisma.mineralAccount.findUnique({ where: { ownerAddress: owner } });
  let openingBalanceMicros = 0n;
  if (!existing) {
    const openingPlanets = (await prisma.backendPlanet.findMany({
      where: { ownerAddress: owner, status: 'READY', generatedAt: { lte: cutoverAt } },
      select: {
        id: true,
        ownerAddress: true,
        planetType: true,
        baseMineralsPerDay: true,
        generatedAt: true,
      },
    })) as MineralAccountPlanetRow[];
    openingBalanceMicros = calculateV1WalletOpeningBalance(
      openingPlanets.map((planet) => ({ ...planet, ownerAddress: owner })),
      cutoverAt,
    );
  }
  // PostgreSQL's upsert locks an existing account row and serializes concurrent creation.
  return prisma.mineralAccount.upsert({
    where: { ownerAddress: owner },
    create: {
      ownerAddress: owner,
      openingBalanceMicros,
      balanceMicros: openingBalanceMicros,
      lastSettledAt: cutoverAt,
    },
    update: { ownerAddress: owner },
  });
}

async function lockPlanet(prisma: Prisma.TransactionClient, planetId: string) {
  if (typeof prisma.$queryRaw === 'function') {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`SELECT "id" FROM "backend_planets" WHERE "id" = ${planetId} FOR UPDATE`,
    );
    if (!rows[0]) return null;
  }
  return prisma.backendPlanet.findUnique({ where: { id: planetId } });
}

function serializePurchase(row: {
  id: string;
  planetId: string;
  walletAddress: string;
  targetLevel: number;
  bonusBpsAfter: number;
  costMicros: bigint;
  purchasedAt: Date;
}) {
  return {
    purchaseId: row.id,
    planetId: row.planetId,
    ownerAddress: normalizeOwner(row.walletAddress),
    targetLevel: row.targetLevel,
    bonusBpsAfter: row.bonusBpsAfter,
    costMicros: row.costMicros.toString(),
    purchasedAt: row.purchasedAt.toISOString(),
  };
}

function serializeUpgradeResult(purchase: Parameters<typeof serializePurchase>[0]) {
  return serializePurchase(purchase);
}

export async function purchasePlanetUpgrade(
  prisma: PrismaClient,
  input: {
    authenticatedWalletAddress: string;
    planetId: string;
    targetLevel: number;
    cutoverAt?: Date | null;
  },
) {
  getMineralUpgradeConfig(input.targetLevel);
  return prisma.$transaction(async (transaction) => {
    await acquireMineralEconomySharedBarrier(transaction);
    const ownerAddress = normalizeOwner(input.authenticatedWalletAddress);
    await acquireMineralWalletLock(transaction, ownerAddress);
    const purchasedAt = await getPostgresClockTimestamp(transaction);
    const resolution = await resolveMineralEconomyForOperation(
      transaction,
      input.cutoverAt,
      purchasedAt,
    );
    if (resolution.state === 'STAGED_V2') throw new Error('Mineral economy is not active yet.');
    const cutoverAt = resolution.cutoverAt;
    if (!cutoverAt) throw new Error('Mineral economy is disabled.');
    const account = await ensureAndLockMineralAccount(transaction, ownerAddress, cutoverAt);
    const planet = await lockPlanet(transaction, input.planetId);
    if (!planet) throw new Error('Planet not found.');
    if (normalizeOwner(planet.ownerAddress) !== ownerAddress) {
      throw new Error('Authenticated wallet does not own this Planet.');
    }
    const existing = await transaction.planetUpgradePurchase.findUnique({
      where: { planetId_targetLevel: { planetId: input.planetId, targetLevel: input.targetLevel } },
    });
    if (existing) {
      if (normalizeOwner(existing.walletAddress) !== ownerAddress) {
        throw new Error('Upgrade target must be the next Planet level.');
      }
      return serializeUpgradeResult(existing);
    }
    if (planet.status !== 'READY') throw new Error('Planet is not ready for upgrades.');
    if (input.targetLevel !== planet.upgradeLevel + 1) {
      throw new Error('Upgrade target must be the next Planet level.');
    }
    assertTimestamp(purchasedAt, 'Upgrade purchase');
    if (purchasedAt < cutoverAt) throw new Error('Mineral economy is not active yet.');

    const planets = (await transaction.backendPlanet.findMany({
      where: { ownerAddress, status: 'READY' },
      select: {
        id: true,
        ownerAddress: true,
        planetType: true,
        baseMineralsPerDay: true,
        generatedAt: true,
        upgradeLevel: true,
        upgradeBonusBps: true,
      },
    })) as MineralSettlementPlanet[];
    const purchases = (await transaction.planetUpgradePurchase.findMany({
      where: { walletAddress: ownerAddress, purchasedAt: { lte: purchasedAt } },
      orderBy: [{ purchasedAt: 'asc' }, { id: 'asc' }],
      select: { planetId: true, targetLevel: true, bonusBpsAfter: true, purchasedAt: true },
    })) as MineralSettlementPurchase[];
    const settledAccount = await settleMineralAccount({
      prisma: transaction,
      account,
      planets,
      purchases,
      settledAt: purchasedAt,
      anchor: cutoverAt,
    });
    const costMicros = calculateUpgradeCostMicros({
      baseMineralsPerDay: planet.baseMineralsPerDay,
      upgradeBonusBps: planet.upgradeBonusBps,
      targetLevel: input.targetLevel,
    });
    if (settledAccount.balanceMicros < costMicros) throw new Error('Insufficient mineral balance.');
    const balanceMicros = settledAccount.balanceMicros - costMicros;
    await transaction.mineralAccount.update({
      where: { ownerAddress },
      data: { balanceMicros, lastSettledAt: purchasedAt },
    });
    await transaction.backendPlanet.update({
      where: { id: planet.id },
      data: { upgradeLevel: input.targetLevel, upgradeBonusBps: getMineralUpgradeConfig(input.targetLevel).bonusBpsAfter },
    });
    const purchase = await transaction.planetUpgradePurchase.create({
      data: {
        planetId: planet.id,
        walletAddress: ownerAddress,
        targetLevel: input.targetLevel,
        bonusBpsAfter: getMineralUpgradeConfig(input.targetLevel).bonusBpsAfter,
        costMicros,
        purchasedAt,
      },
    });
    return serializeUpgradeResult(purchase);
  });
}
