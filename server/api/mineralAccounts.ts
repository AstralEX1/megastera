import { type CollectionMiningPlanet, calculateCollectionMining } from './collectionMining.js';
import {
  calculateHistoricalProduction,
  type MineralCollectionPlanet,
  type MineralUpgradePurchase,
} from './mineralEconomy.js';
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

type MineralEconomyCutoverClient = Pick<Prisma.TransactionClient, 'mineralEconomyCutover'>;
type PostgresClockClient = Pick<Prisma.TransactionClient, '$queryRaw'>;

function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && (error as { code?: unknown }).code === 'P2002');
}

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
  const row = await prisma.mineralEconomyCutover.findUnique({ where: { id: 1 } });
  return row?.cutoverAt ?? null;
}

/** Creates the immutable singleton on first use and rejects a configured conflict. */
export async function ensureMineralEconomyCutover(
  prisma: MineralEconomyCutoverClient,
  cutoverAt: Date | null | undefined,
) {
  if (!cutoverAt) return null;
  assertCutover(cutoverAt);
  const existing = await readMineralEconomyCutover(prisma);
  if (existing) {
    if (existing.getTime() !== cutoverAt.getTime()) {
      throw new Error('Configured mineral economy cutover conflicts with the persisted database cutover.');
    }
    return { id: 1, cutoverAt: existing };
  }
  try {
    return await prisma.mineralEconomyCutover.create({ data: { id: 1, cutoverAt } });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    const concurrent = await readMineralEconomyCutover(prisma);
    if (!concurrent) throw error;
    if (concurrent.getTime() !== cutoverAt.getTime()) {
      throw new Error('Configured mineral economy cutover conflicts with the persisted database cutover.');
    }
    return { id: 1, cutoverAt: concurrent };
  }
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
  prisma: PrismaClient,
  cutoverAt: Date,
): Promise<{ rows: MineralBackfillRow[]; existingOwners: Set<string> }> {
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
  const existing = rows.length
    ? await prisma.mineralAccount.findMany({
        where: { ownerAddress: { in: rows.map((row) => row.ownerAddress) } },
        select: { ownerAddress: true },
      })
    : [];
  return {
    rows,
    existingOwners: new Set(existing.map((row) => row.ownerAddress.toLowerCase())),
  };
}

export async function runMineralAccountsBackfill(
  prisma: PrismaClient,
  cutoverAt: Date | null | undefined,
  options: { dryRun?: boolean } = {},
): Promise<MineralAccountsBackfillResult> {
  if (!cutoverAt) throw new Error('MINERAL_ECONOMY_CUTOVER_AT is required for mineral backfill.');
  assertCutover(cutoverAt);
  const { rows, existingOwners } = await loadMineralBackfillRows(prisma, cutoverAt);
  const missing = rows.filter((row) => !existingOwners.has(row.ownerAddress));
  const openingBalanceMicros = rows.reduce((total, row) => total + row.openingBalanceMicros, 0n);
  const missingOpeningBalanceMicros = missing.reduce(
    (total, row) => total + row.openingBalanceMicros,
    0n,
  );
  const result = {
    cutoverAt,
    candidateCount: rows.length,
    existingCount: rows.length - missing.length,
    missingCount: missing.length,
    openingBalanceMicros,
    missingOpeningBalanceMicros,
    createdCount: 0,
  } satisfies MineralAccountsBackfillResult;
  if (options.dryRun) {
    const persisted = await readMineralEconomyCutover(prisma);
    if (persisted && persisted.getTime() !== cutoverAt.getTime()) {
      throw new Error('Configured mineral economy cutover conflicts with the persisted database cutover.');
    }
    return result;
  }
  const created = await prisma.$transaction(async (transaction) => {
    const databaseNow = await getPostgresClockTimestamp(transaction);
    if (databaseNow < cutoverAt) {
      throw new Error('Mineral backfill cannot run before the configured cutover in PostgreSQL.');
    }
    await ensureMineralEconomyCutover(transaction, cutoverAt);
    return transaction.mineralAccount.createMany({
      data: missing.map((row) => ({
        ownerAddress: row.ownerAddress,
        openingBalanceMicros: row.openingBalanceMicros,
        balanceMicros: row.openingBalanceMicros,
        lastSettledAt: cutoverAt,
      })),
      skipDuplicates: true,
    });
  });
  return { ...result, createdCount: created.count };
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
  settledAt: Date;
  anchor: Date;
}) {
  assertTimestamp(input.settledAt, 'Settlement');
  assertTimestamp(input.account.lastSettledAt, 'Account settlement');
  if (input.settledAt < input.account.lastSettledAt) {
    throw new Error('Settlement timestamp cannot move backwards.');
  }
  const producedMicros = calculateHistoricalProduction({
    planets: input.planets,
    purchases: input.purchases,
    from: input.account.lastSettledAt,
    to: input.settledAt,
    anchor: input.anchor,
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

export async function purchasePlanetUpgrade(
  prisma: PrismaClient,
  input: {
    planetId: string;
    targetLevel: number;
    cutoverAt: Date;
    now: () => Date;
  },
) {
  assertTimestamp(input.cutoverAt, 'Mineral economy cutover');
  getMineralUpgradeConfig(input.targetLevel);
  return prisma.$transaction(async (transaction) => {
    await ensureMineralEconomyCutover(transaction, input.cutoverAt);
    const ownerHint = await transaction.backendPlanet.findUnique({
      where: { id: input.planetId },
      select: { ownerAddress: true },
    });
    if (!ownerHint) throw new Error('Planet not found.');
    const ownerAddress = normalizeOwner(ownerHint.ownerAddress);
    const account = await ensureAndLockMineralAccount(transaction, ownerAddress, input.cutoverAt);
    const planet = await lockPlanet(transaction, input.planetId);
    if (!planet) throw new Error('Planet not found.');
    const existing = await transaction.planetUpgradePurchase.findUnique({
      where: { planetId_targetLevel: { planetId: input.planetId, targetLevel: input.targetLevel } },
    });
    if (existing) return serializePurchase(existing);
    if (planet.ownerAddress.toLowerCase() !== ownerAddress) throw new Error('Planet owner changed.');
    if (planet.status !== 'READY') throw new Error('Planet is not ready for upgrades.');
    if (input.targetLevel !== planet.upgradeLevel + 1) {
      throw new Error('Upgrade target must be the next Planet level.');
    }
    const purchasedAt = await getPostgresClockTimestamp(transaction);
    assertTimestamp(purchasedAt, 'Upgrade purchase');
    if (purchasedAt < input.cutoverAt) throw new Error('Mineral economy is not active yet.');

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
      anchor: input.cutoverAt,
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
    return { ...serializePurchase(purchase), currentBalanceMicros: balanceMicros.toString() };
  });
}
