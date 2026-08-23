import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from './generated/prisma/client.js';
import {
  acquireMineralWalletLock,
  calculateCurrentMineralBalanceMicros,
  calculateV1WalletOpeningBalance,
  initializeMineralAccounts,
} from './mineralAccounts.js';

const OWNER = '0x1111111111111111111111111111111111111111';
const CUTOVER = new Date('2026-08-20T00:00:00.000Z');

describe('MineralAccount initialization', () => {
  it('uses the persisted balance plus canonical post-cutover production', () => {
    const planet = {
      id: 'current-balance',
      ownerAddress: OWNER,
      planetType: 'Gaia',
      baseMineralsPerDay: 1n,
      generatedAt: CUTOVER,
    };

    expect(calculateCurrentMineralBalanceMicros({
      account: {
        balanceMicros: 100n,
        lastSettledAt: CUTOVER,
      },
      openingBalanceMicros: 0n,
      cutoverAt: CUTOVER,
      asOf: new Date('2026-08-21T00:00:00.000Z'),
      planets: [planet],
      purchases: [],
    })).toBe(1_000_100n);
  });

  it('uses Galaxy Pulse boundaries for the current wallet balance', () => {
    expect(calculateCurrentMineralBalanceMicros({
      account: { balanceMicros: 0n, lastSettledAt: CUTOVER },
      openingBalanceMicros: 0n,
      cutoverAt: CUTOVER,
      asOf: new Date('2026-08-22T00:00:00.000Z'),
      planets: [{
        id: 'pulse-wallet',
        ownerAddress: OWNER,
        planetType: 'Gaia',
        baseMineralsPerDay: 1n,
        generatedAt: CUTOVER,
      }],
      purchases: [],
      pulseRounds: [{
        settledAt: new Date('2026-08-21T00:00:00.000Z'),
        modifiersBps: { gaia: 5_000 },
      }],
    })).toBe(2_500_000n);
  });

  it('rejects a missing account when spending history exists', () => {
    expect(() => calculateCurrentMineralBalanceMicros({
      account: null,
      openingBalanceMicros: 100n,
      cutoverAt: CUTOVER,
      asOf: new Date('2026-08-21T00:00:00.000Z'),
      planets: [],
      purchases: [{
        planetId: 'spent',
        targetLevel: 1,
        bonusBpsAfter: 1_000,
        purchasedAt: new Date('2026-08-20T12:00:00.000Z'),
      }],
    })).toThrow('without a MineralAccount');
  });

  it('takes a transaction-scoped advisory lock for one wallet', async () => {
    const queryRaw = vi.fn().mockResolvedValue([{ locked: 1 }]);

    await acquireMineralWalletLock({ $queryRaw: queryRaw }, OWNER);

    const query = queryRaw.mock.calls[0]?.[0] as readonly string[];
    expect(query.join('')).toContain('pg_advisory_xact_lock');
    expect(query.join('')).toContain('mineral-wallet');
  });

  it('keeps the V1 wallet opening balance bit-for-bit', () => {
    expect(
      calculateV1WalletOpeningBalance(
        [
          {
            id: 'one',
            ownerAddress: OWNER,
            planetType: 'Gaia',
            baseMineralsPerDay: 100n,
            generatedAt: new Date('2026-08-17T00:00:00.000Z'),
          },
          {
            id: 'two',
            ownerAddress: OWNER,
            planetType: 'Gaia',
            baseMineralsPerDay: 100n,
            generatedAt: new Date('2026-08-18T00:00:00.000Z'),
          },
          {
            id: 'three',
            ownerAddress: OWNER,
            planetType: 'Gaia',
            baseMineralsPerDay: 100n,
            generatedAt: new Date('2026-08-19T00:00:00.000Z'),
          },
        ],
        CUTOVER,
      ),
    ).toBe(615_000_000n);
  });

  it('batch-reads Planets and uses create-only idempotent account writes', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: 'one',
        ownerAddress: OWNER.toUpperCase(),
        planetType: 'Gaia',
        baseMineralsPerDay: 100n,
        generatedAt: new Date('2026-08-19T00:00:00.000Z'),
      },
      {
        id: 'two',
        ownerAddress: '0x2222222222222222222222222222222222222222',
        planetType: 'Nebula',
        baseMineralsPerDay: 50n,
        generatedAt: new Date('2026-08-19T00:00:00.000Z'),
      },
    ]);
    const createMany = vi.fn().mockResolvedValue({ count: 2 });
    const prisma = {
      backendPlanet: { findMany },
      mineralAccount: { createMany },
    } as unknown as PrismaClient;

    await expect(initializeMineralAccounts(prisma, CUTOVER)).resolves.toMatchObject({
      candidateCount: 2,
      createdCount: 2,
    });
    expect(findMany).toHaveBeenCalledOnce();
    expect(createMany).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }));
    expect(createMany.mock.calls[0]?.[0].data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ownerAddress: OWNER,
          openingBalanceMicros: 100_000_000n,
          balanceMicros: 100_000_000n,
          lastSettledAt: CUTOVER,
        }),
      ]),
    );
  });

  it('does not write accounts while the optional cutover is absent', async () => {
    const createMany = vi.fn();
    const prisma = {
      backendPlanet: { findMany: vi.fn() },
      mineralAccount: { createMany },
    } as unknown as PrismaClient;

    await expect(initializeMineralAccounts(prisma, null)).resolves.toEqual({
      candidateCount: 0,
      createdCount: 0,
    });
    expect(createMany).not.toHaveBeenCalled();
  });

  it('does not reset an existing account on a second initialization', async () => {
    const findMany = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: 'one',
          ownerAddress: OWNER,
          planetType: 'Gaia',
          baseMineralsPerDay: 1n,
          generatedAt: new Date('2026-08-19T00:00:00.000Z'),
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'one',
          ownerAddress: OWNER,
          planetType: 'Gaia',
          baseMineralsPerDay: 100n,
          generatedAt: new Date('2026-08-19T00:00:00.000Z'),
        },
      ]);
    const persisted = new Map<string, Record<string, unknown>>();
    const createMany = vi
      .fn()
      .mockImplementation(({ data }: { data: Record<string, unknown>[] }) => {
        let count = 0;
        for (const row of data) {
          const ownerAddress = String(row.ownerAddress);
          if (persisted.has(ownerAddress)) continue;
          persisted.set(ownerAddress, { ...row });
          count += 1;
        }
        return { count };
      });
    const prisma = {
      backendPlanet: { findMany },
      mineralAccount: { createMany },
    } as unknown as PrismaClient;

    await initializeMineralAccounts(prisma, CUTOVER);
    const second = await initializeMineralAccounts(prisma, CUTOVER);

    expect(second.createdCount).toBe(0);
    expect(persisted.get(OWNER)).toMatchObject({
      openingBalanceMicros: 1_000_000n,
      balanceMicros: 1_000_000n,
    });
  });
});
