import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from './generated/prisma/client.js';
import { calculateV1WalletOpeningBalance, initializeMineralAccounts } from './mineralAccounts.js';

const OWNER = '0x1111111111111111111111111111111111111111';
const CUTOVER = new Date('2026-08-20T00:00:00.000Z');

describe('MineralAccount initialization', () => {
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
});
