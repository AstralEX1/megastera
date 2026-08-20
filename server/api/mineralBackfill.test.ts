import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from './generated/prisma/client.js';
import { runMineralAccountsBackfill } from './mineralAccounts.js';

const OWNER = '0x1111111111111111111111111111111111111111';
const CUTOVER = new Date('2026-08-20T00:00:00.000Z');

function makePrisma(dbNow: Date) {
  const createMany = vi.fn().mockResolvedValue({ count: 1 });
  const transaction = {
    $queryRaw: vi.fn().mockResolvedValue([{ now: dbNow }]),
    mineralEconomyCutover: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 1, cutoverAt: CUTOVER }),
    },
    mineralAccount: { createMany },
  };
  const prisma = {
    backendPlanet: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'planet-1',
          ownerAddress: OWNER,
          planetType: 'Gaia',
          baseMineralsPerDay: 100n,
          generatedAt: new Date('2026-08-19T00:00:00.000Z'),
        },
      ]),
    },
    mineralAccount: { findMany: vi.fn().mockResolvedValue([]) },
    mineralEconomyCutover: { findUnique: vi.fn().mockResolvedValue(null) },
    $transaction: vi.fn(async (callback: (value: typeof transaction) => unknown) =>
      callback(transaction),
    ),
  } as unknown as PrismaClient;
  return { prisma, createMany, transaction };
}

describe('Mineral account backfill', () => {
  it('dry-runs without writes and reports the exact V1 opening total', async () => {
    const { prisma, createMany } = makePrisma(new Date('2026-08-21T00:00:00.000Z'));

    await expect(
      runMineralAccountsBackfill(prisma, CUTOVER, { dryRun: true }),
    ).resolves.toMatchObject({
      candidateCount: 1,
      missingCount: 1,
      missingOpeningBalanceMicros: 100_000_000n,
      createdCount: 0,
    });
    expect(createMany).not.toHaveBeenCalled();
  });

  it('refuses mutation while PostgreSQL time is before cutover', async () => {
    const { prisma, createMany } = makePrisma(new Date('2026-08-19T23:59:59.999Z'));

    await expect(runMineralAccountsBackfill(prisma, CUTOVER)).rejects.toThrow(
      'Mineral backfill cannot run before the configured cutover',
    );
    expect(createMany).not.toHaveBeenCalled();
  });
});
