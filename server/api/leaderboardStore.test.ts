import { describe, expect, it } from 'vitest';
import type { PrismaClient } from './generated/prisma/client';
import {
  calculateLiveLeaderboardRows,
  calculateLeaderboardRows,
  createLiveLeaderboardCache,
  finalizeLeaderboardPeriod,
  paginateLeaderboardRows,
} from './leaderboardStore';

const ADDRESS_A = '0x1111111111111111111111111111111111111111';
const ADDRESS_B = '0x2222222222222222222222222222222222222222';
const PERIOD = {
  id: '2026-08-10',
  startsAt: new Date('2026-08-10T00:00:00.000Z'),
  endsAt: new Date('2026-08-17T00:00:00.000Z'),
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

  it('refreshes a cached live snapshot only after its TTL expires', async () => {
    const cache = createLiveLeaderboardCache(60_000);
    let loads = 0;
    const load = async (asOf: Date) => {
      loads += 1;
      return { asOf, rows: [] };
    };
    const firstNow = new Date('2026-08-20T00:00:00.000Z');

    const first = await cache.get(firstNow, load);
    const withinTtl = await cache.get(new Date(firstNow.getTime() + 59_999), load);
    const afterTtl = await cache.get(new Date(firstNow.getTime() + 60_000), load);

    expect(loads).toBe(2);
    expect(withinTtl).toBe(first);
    expect(afterTtl).not.toBe(first);
    expect(afterTtl.asOf).toEqual(new Date('2026-08-20T00:01:00.000Z'));
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
    let lockQuery = '';
    const transaction = {
      $queryRaw: async (strings: TemplateStringsArray) => {
        lockQuery = strings.join('?');
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

    expect(lockQuery).toContain('SELECT 1 AS locked');
    expect(lockQuery).toContain('pg_advisory_xact_lock');
  });

  it('archives a period only once when finalization is retried', async () => {
    let periodRecord: { id: string; finalizedAt: Date } | undefined;
    let periodWrites = 0;
    let lockCalls = 0;
    const transaction = {
      $queryRaw: async () => {
        lockCalls += 1;
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
    expect(lockCalls).toBe(2);
  });
});
