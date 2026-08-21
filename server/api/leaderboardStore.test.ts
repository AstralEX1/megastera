import { describe, expect, it, vi } from 'vitest';
import { Prisma, type PrismaClient } from './generated/prisma/client.js';
import {
  calculatePostCutoverLeaderboardRows,
  calculateLiveLeaderboardRows,
  calculateLeaderboardRows,
  ensureOverdueLeaderboardPeriodsFinalized,
  finalizeLeaderboardPeriod,
  getCurrentLeaderboard,
  paginateLeaderboardRows,
} from './leaderboardStore.js';

const ADDRESS_A = '0x1111111111111111111111111111111111111111';
const ADDRESS_B = '0x2222222222222222222222222222222222222222';
const PERIOD = {
  id: '2026-08-10',
  startsAt: new Date('2026-08-10T00:00:00.000Z'),
  endsAt: new Date('2026-08-17T00:00:00.000Z'),
};
const CUTOVER = new Date('2026-08-20T00:00:00.000Z');
const POST_CUTOVER_PERIOD = {
  id: '2026-08-20',
  startsAt: CUTOVER,
  endsAt: new Date('2026-08-21T00:00:00.000Z'),
};

describe('calculateLeaderboardRows', () => {
  it('calculates lifetime production from immutable Planet traits and mint times', () => {
    const rows = calculateLeaderboardRows({
      period: PERIOD,
      asOf: new Date('2026-08-11T00:00:00.000Z'),
      planets: [
        {
          id: 'planet-a',
          ownerAddress: ADDRESS_A,
          baseMineralsPerDay: 24n,
          mintedAt: new Date('2026-08-09T00:00:00.000Z'),
        },
        {
          id: 'planet-b',
          ownerAddress: ADDRESS_B,
          baseMineralsPerDay: 12n,
          mintedAt: new Date('2026-08-10T00:00:00.000Z'),
        },
      ],
    });

    expect(rows).toEqual([
      {
        rank: 1,
        walletAddress: ADDRESS_A,
        scoreMicros: 48_000_000n,
        effectiveMineralsPerDayMicros: 24_000_000n,
      },
      {
        rank: 2,
        walletAddress: ADDRESS_B,
        scoreMicros: 12_000_000n,
        effectiveMineralsPerDayMicros: 12_000_000n,
      },
    ]);
  });

  it('does not count a Planet minted after the UTC snapshot boundary', () => {
    const rows = calculateLeaderboardRows({
      period: PERIOD,
      asOf: new Date('2026-08-20T00:00:00.000Z'),
      planets: [
        {
          id: 'future-planet',
          ownerAddress: ADDRESS_A,
          baseMineralsPerDay: 10n,
          mintedAt: new Date('2026-08-20T00:00:00.000Z'),
        },
      ],
    });

    expect(rows).toEqual([]);
  });

  it('applies the same-type bonus to typed lifetime rows at the snapshot boundary', () => {
    const rows = calculateLeaderboardRows({
      period: PERIOD,
      asOf: new Date('2026-08-11T00:00:00.000Z'),
      planets: [
        {
          id: 'planet-a1',
          ownerAddress: ADDRESS_A,
          planetType: 'Nebula',
          baseMineralsPerDay: 100n,
          mintedAt: new Date('2026-08-08T00:00:00.000Z'),
        },
        {
          id: 'planet-a2',
          ownerAddress: ADDRESS_A,
          planetType: 'Nebula',
          baseMineralsPerDay: 100n,
          mintedAt: new Date('2026-08-09T00:00:00.000Z'),
        },
        {
          id: 'planet-a3',
          ownerAddress: ADDRESS_A,
          planetType: 'Nebula',
          baseMineralsPerDay: 100n,
          mintedAt: new Date('2026-08-10T00:00:00.000Z'),
        },
      ],
    });

    expect(rows).toEqual([
      {
        rank: 1,
        walletAddress: ADDRESS_A,
        scoreMicros: 615_000_000n,
        effectiveMineralsPerDayMicros: 315_000_000n,
      },
    ]);
  });
});
describe('live leaderboard', () => {
  it('scores every ready Backend Planet from generatedAt without a UTC-day cutoff', () => {
    const rows = calculateLiveLeaderboardRows({
      asOf: new Date('2026-08-20T00:00:00.000Z'),
      planets: [
        {
          id: 'planet-1',
          ownerAddress: ADDRESS_A,
          planetType: 'Nebula',
          baseMineralsPerDay: 24n,
          generatedAt: new Date('2026-08-19T00:00:00.000Z'),
        },
      ],
    });

    expect(rows).toEqual([
      {
        rank: 1,
        walletAddress: ADDRESS_A,
        scoreMicros: 24_000_000n,
        effectiveMineralsPerDayMicros: 24_000_000n,
      },
    ]);
  });

  it('applies the same-type bonus to every Planet while keeping other types unmodified', () => {
    const rows = calculateLiveLeaderboardRows({
      asOf: new Date('2026-08-20T00:00:00.000Z'),
      planets: [
        { id: 'a1', ownerAddress: ADDRESS_A, planetType: 'Nebula', baseMineralsPerDay: 100n, generatedAt: new Date('2026-08-17T00:00:00.000Z') },
        { id: 'a2', ownerAddress: ADDRESS_A, planetType: 'Nebula', baseMineralsPerDay: 100n, generatedAt: new Date('2026-08-18T00:00:00.000Z') },
        { id: 'a3', ownerAddress: ADDRESS_A, planetType: 'Nebula', baseMineralsPerDay: 100n, generatedAt: new Date('2026-08-19T00:00:00.000Z') },
        { id: 'a4', ownerAddress: ADDRESS_A, planetType: 'Gaia', baseMineralsPerDay: 100n, generatedAt: new Date('2026-08-19T00:00:00.000Z') },
        { id: 'b1', ownerAddress: ADDRESS_B, planetType: 'Nebula', baseMineralsPerDay: 100n, generatedAt: new Date('2026-08-19T00:00:00.000Z') },
      ],
    });

    expect(rows).toEqual([
      {
        rank: 1,
        walletAddress: ADDRESS_A,
        scoreMicros: 715_000_000n,
        effectiveMineralsPerDayMicros: 415_000_000n,
      },
      {
        rank: 2,
        walletAddress: ADDRESS_B,
        scoreMicros: 100_000_000n,
        effectiveMineralsPerDayMicros: 100_000_000n,
      },
    ]);
  });

  it('rechecks a staged cutover after entering the PostgreSQL transaction', async () => {
    const cutoverAt = new Date('2026-08-20T00:00:00.000Z');
    const rootClock = vi.fn().mockResolvedValue([{ now: new Date(cutoverAt.getTime() - 1) }]);
    const transactionClock = vi.fn().mockResolvedValue([{ now: cutoverAt }]);
    const prisma = {
      $queryRaw: rootClock,
      mineralEconomyCutover: { findUnique: vi.fn().mockResolvedValue(null) },
      backendPlanet: { findMany: vi.fn().mockResolvedValue([]) },
      $transaction: vi.fn(async (callback: (client: unknown) => unknown) => callback({
        $queryRaw: transactionClock,
        mineralEconomyCutover: { findUnique: vi.fn().mockResolvedValue(null) },
      })),
    } as unknown as PrismaClient;

    await expect(
      getCurrentLeaderboard(prisma, new Date(), { offset: 0, limit: 50 }, {
        mineralEconomyCutoverAt: cutoverAt,
      }),
    ).rejects.toThrow('configured mineral economy cutover is not persisted');
  });

  it('shows a spend immediately after the next leaderboard read', async () => {
    const purchases: Array<Record<string, unknown>> = [];
    const findMany = vi.fn().mockImplementation(async () => [
      {
        id: 'planet-1',
        ownerAddress: ADDRESS_A,
        planetType: 'Gaia',
        baseMineralsPerDay: 100n,
        generatedAt: CUTOVER,
      },
    ]);
    const accounts = vi.fn().mockResolvedValue([
      { ownerAddress: ADDRESS_A, openingBalanceMicros: 100_000_000n },
    ]);
    const purchaseRows = vi.fn().mockImplementation(async () => purchases);
    const readTransactionOptions: unknown[] = [];
    const transaction = {
      backendPlanet: { findMany },
      mineralAccount: { findMany: accounts },
      planetUpgradePurchase: { findMany: purchaseRows },
    };
    const prisma = {
      ...transaction,
      $transaction: vi.fn(async (
        operation: (value: typeof transaction) => unknown,
        options?: unknown,
      ) => {
        readTransactionOptions.push(options);
        return operation(transaction);
      }),
    } as unknown as PrismaClient;
    const now = new Date('2026-08-20T12:00:00.000Z');

    const before = await getCurrentLeaderboard(
      prisma,
      now,
      { offset: 0, limit: 50 },
      { mineralEconomyCutoverAt: CUTOVER },
    );
    purchases.push({
      planetId: 'planet-1',
      walletAddress: ADDRESS_A,
      targetLevel: 1,
      bonusBpsAfter: 1_000,
      costMicros: 200_000n,
      purchasedAt: now,
    });
    const after = await getCurrentLeaderboard(
      prisma,
      now,
      { offset: 0, limit: 50 },
      { mineralEconomyCutoverAt: CUTOVER },
    );

    expect(before.rows[0]?.scoreMicros).toBeGreaterThan(after.rows[0]?.scoreMicros ?? 0n);
    expect(findMany).toHaveBeenCalledTimes(2);
    expect(accounts).toHaveBeenCalledTimes(2);
    expect(purchaseRows).toHaveBeenCalledTimes(2);
    expect(readTransactionOptions[0]).toEqual({
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });
  });
});

describe('post-cutover spendable leaderboard', () => {
  it('rejects a reconstructed negative spendable balance', () => {
    expect(() => calculatePostCutoverLeaderboardRows({
      period: POST_CUTOVER_PERIOD,
      asOf: POST_CUTOVER_PERIOD.endsAt,
      cutoverAt: CUTOVER,
      accounts: [{ ownerAddress: ADDRESS_A, openingBalanceMicros: 0n }],
      planets: [{
        id: 'planet-1',
        ownerAddress: ADDRESS_A,
        planetType: 'Gaia',
        baseMineralsPerDay: 1n,
        generatedAt: CUTOVER,
      }],
      purchases: [{
        planetId: 'planet-1',
        walletAddress: ADDRESS_A,
        targetLevel: 1,
        bonusBpsAfter: 1_000,
        costMicros: 2_000_001n,
        purchasedAt: new Date('2026-08-20T00:00:00.001Z'),
      }],
    })).toThrow('negative');
  });

  it('reconstructs balance from opening balance, canonical production, and purchase costs', () => {
    const rows = calculatePostCutoverLeaderboardRows({
      period: POST_CUTOVER_PERIOD,
      asOf: POST_CUTOVER_PERIOD.endsAt,
      cutoverAt: CUTOVER,
      accounts: [{ ownerAddress: ADDRESS_A, openingBalanceMicros: 100_000_000n }],
      planets: [{
        id: 'planet-1',
        ownerAddress: ADDRESS_A,
        planetType: 'Gaia',
        baseMineralsPerDay: 100n,
        generatedAt: CUTOVER,
      }],
      purchases: [{
        planetId: 'planet-1',
        walletAddress: ADDRESS_A,
        targetLevel: 1,
        bonusBpsAfter: 1_000,
        costMicros: 200_000n,
        purchasedAt: new Date('2026-08-20T12:00:00.000Z'),
      }],
    });

    expect(rows).toEqual([{
      rank: 1,
      walletAddress: ADDRESS_A,
      scoreMicros: 204_800_000n,
      effectiveMineralsPerDayMicros: 110_000_000n,
    }]);
  });

  it('keeps activation and purchase events at period end in the next period', () => {
    const rows = calculatePostCutoverLeaderboardRows({
      period: POST_CUTOVER_PERIOD,
      asOf: POST_CUTOVER_PERIOD.endsAt,
      cutoverAt: CUTOVER,
      accounts: [{ ownerAddress: ADDRESS_A, openingBalanceMicros: 0n }],
      planets: [
        {
          id: 'planet-1',
          ownerAddress: ADDRESS_A,
          planetType: 'Gaia',
          baseMineralsPerDay: 100n,
          generatedAt: CUTOVER,
        },
        {
          id: 'planet-2',
          ownerAddress: ADDRESS_A,
          planetType: 'Gaia',
          baseMineralsPerDay: 100n,
          generatedAt: POST_CUTOVER_PERIOD.endsAt,
        },
      ],
      purchases: [{
        planetId: 'planet-1',
        walletAddress: ADDRESS_A,
        targetLevel: 1,
        bonusBpsAfter: 1_000,
        costMicros: 200_000n,
        purchasedAt: POST_CUTOVER_PERIOD.endsAt,
      }],
    });

    expect(rows[0]?.scoreMicros).toBe(100_000_000n);
    expect(rows[0]?.effectiveMineralsPerDayMicros).toBe(100_000_000n);
  });
});

describe('overdue leaderboard finalization', () => {
  it('finalizes overdue post-cutover periods with spendable balances', async () => {
    const finalized = new Map<string, Date>();
    const entries: Array<Record<string, unknown>> = [];
    const periodFindUnique = vi.fn().mockImplementation(async ({ where }: { where: { id: string } }) =>
      finalized.has(where.id) ? { id: where.id, finalizedAt: finalized.get(where.id) } : undefined,
    );
    const transaction = {
      $queryRaw: vi.fn().mockResolvedValue([{ now: new Date('2026-08-22T00:00:00.000Z') }]),
      leaderboardPeriod: {
        findUnique: periodFindUnique,
        upsert: vi.fn().mockImplementation(async ({ create }: { create: { id: string; finalizedAt: Date } }) => {
          finalized.set(create.id, create.finalizedAt);
          return create;
        }),
      },
      leaderboardEntry: {
        createMany: vi.fn().mockImplementation(async ({ data }: { data: Array<Record<string, unknown>> }) => {
          entries.push(...data);
          return { count: data.length };
        }),
        findMany: vi.fn().mockResolvedValue([]),
      },
      backendPlanet: {
        findFirst: vi.fn().mockResolvedValue({ generatedAt: CUTOVER }),
        findMany: vi.fn().mockResolvedValue([{
          id: 'planet-1',
          ownerAddress: ADDRESS_A,
          planetType: 'Gaia',
          baseMineralsPerDay: 100n,
          generatedAt: CUTOVER,
        }]),
      },
      mineralEconomyCutover: {
        findUnique: vi.fn().mockResolvedValue({ id: 1, cutoverAt: CUTOVER }),
      },
      mineralAccount: {
        findMany: vi.fn().mockResolvedValue([{ ownerAddress: ADDRESS_A, openingBalanceMicros: 0n }]),
      },
      planetUpgradePurchase: {
        findMany: vi.fn().mockResolvedValue([{
          planetId: 'planet-1',
          walletAddress: ADDRESS_A,
          targetLevel: 1,
          bonusBpsAfter: 1_000,
          costMicros: 200_000n,
          purchasedAt: new Date('2026-08-20T12:00:00.000Z'),
        }]),
      },
    };
    const transactionOptions: unknown[] = [];
    const prisma = {
      leaderboardPeriod: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      backendPlanet: transaction.backendPlanet,
      $transaction: vi.fn(async (
        operation: (value: typeof transaction) => unknown,
        options?: unknown,
      ) => {
        transactionOptions.push(options);
        return operation(transaction);
      }),
    } as unknown as PrismaClient;

    await ensureOverdueLeaderboardPeriodsFinalized(
      prisma,
      new Date('2026-08-22T00:00:00.000Z'),
      { mineralEconomyCutoverAt: CUTOVER },
    );

    expect(entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ periodId: '2026-08-20', scoreMicros: 104_800_000n }),
      expect.objectContaining({ periodId: '2026-08-21', scoreMicros: 214_800_000n }),
    ]));
    expect(transactionOptions[0]).toEqual({
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    });
  });
});

describe('paginateLeaderboardRows', () => {
  it('returns bounded rows and the original total', () => {
    const rows = Array.from({ length: 5 }, (_, index) => ({
      rank: index + 1,
      walletAddress: `wallet-${index + 1}`,
      scoreMicros: BigInt(5 - index),
      effectiveMineralsPerDayMicros: 1n,
    }));

    expect(paginateLeaderboardRows(rows, { offset: 1, limit: 2 })).toEqual({
      total: 5,
      offset: 1,
      limit: 2,
      rows: rows.slice(1, 3),
    });
  });
});

describe('finalizeLeaderboardPeriod', () => {
  it('wraps the void advisory-lock result in a scalar for Prisma decoding', async () => {
    const lockQueries: string[] = [];
    let rawCalls = 0;
    const transaction = {
      $queryRaw: async (...args: unknown[]) => {
        const query = args[0] as { values?: unknown[]; strings?: string[] } | TemplateStringsArray;
        const rendered = Array.isArray(query)
          ? query.join('?')
          : query && 'strings' in query && Array.isArray(query.strings)
            ? query.strings.join('?')
            : String(query);
        lockQueries.push(rendered);
        rawCalls += 1;
        return rawCalls % 2 === 0
          ? [{ now: new Date('2026-08-18T00:00:00.000Z') }]
          : [{ locked: 1 }];
      },
      leaderboardPeriod: {
        findUnique: async () => undefined,
        upsert: async ({ create }: { create: typeof PERIOD }) => create,
      },
      leaderboardEntry: {
        createMany: async () => ({ count: 0 }),
        findMany: async () => [],
      },
      planet: { findMany: async () => [] },
    };
    const prisma = {
      $transaction: async (operation: (client: typeof transaction) => Promise<unknown>) =>
        operation(transaction),
    } as unknown as PrismaClient;

    await finalizeLeaderboardPeriod(prisma, PERIOD, new Date('2026-08-17T00:00:01.000Z'));

    expect(lockQueries.join('\n')).toContain('SELECT 1 AS locked');
    expect(lockQueries.join('\n')).toContain('pg_advisory_xact_lock');
  });

  it('archives a period only once when finalization is retried', async () => {
    let periodRecord: { id: string; finalizedAt: Date } | undefined;
    let periodWrites = 0;
    let lockCalls = 0;
    const transaction = {
      $queryRaw: async () => {
        lockCalls += 1;
        return lockCalls % 2 === 0
          ? [{ now: new Date('2026-08-18T00:00:00.000Z') }]
          : [{ locked: 1 }];
      },
      leaderboardPeriod: {
        findUnique: async () => periodRecord,
        upsert: async ({ create }: { create: { id: string; finalizedAt: Date } }) => {
          periodWrites += 1;
          periodRecord = { id: create.id, finalizedAt: create.finalizedAt };
          return periodRecord;
        },
      },
      leaderboardEntry: {
        createMany: async () => ({ count: 0 }),
        findMany: async () => [],
      },
      planet: { findMany: async () => [] },
    };
    const prisma = {
      $transaction: async (operation: (client: typeof transaction) => Promise<unknown>) =>
        operation(transaction),
    } as unknown as PrismaClient;

    await finalizeLeaderboardPeriod(prisma, PERIOD, new Date('2026-08-17T00:00:01.000Z'));
    await finalizeLeaderboardPeriod(prisma, PERIOD, new Date('2026-08-17T00:01:00.000Z'));

    expect(periodWrites).toBe(1);
    expect(lockCalls).toBe(4);
  });
});
