import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from './generated/prisma/client.js';
import { purchasePlanetUpgrade, settleMineralAccount } from './mineralAccounts.js';

const OWNER = '0x1111111111111111111111111111111111111111';
const CUTOVER = new Date('2026-08-20T00:00:00.000Z');
const PURCHASED_AT = new Date('2026-08-21T00:00:00.000Z');

function makePlanet() {
  return {
    id: 'planet-1',
    ownerAddress: OWNER,
    planetType: 'Gaia',
    baseMineralsPerDay: 1n,
    upgradeLevel: 0,
    upgradeBonusBps: 0,
    generatedAt: CUTOVER,
    status: 'READY' as const,
  };
}

function makePrisma(overrides: {
  account?: Record<string, unknown>;
  existingPurchase?: Record<string, unknown> | null;
  clockAt?: Date;
} = {}) {
  const planet = makePlanet();
  const balanceMicros = typeof overrides.account?.balanceMicros === 'bigint' ? overrides.account.balanceMicros : 500_000n;
  const lastSettledAt = overrides.account?.lastSettledAt instanceof Date ? overrides.account.lastSettledAt : CUTOVER;
  const account = {
    id: 'account-1',
    ownerAddress: OWNER,
    openingBalanceMicros: 0n,
    balanceMicros,
    lastSettledAt,
  };
  const purchase = overrides.existingPurchase ?? null;
  const clockAt = overrides.clockAt ?? PURCHASED_AT;
  const tx = {
    $queryRaw: vi
      .fn()
      .mockResolvedValueOnce([{ id: planet.id }])
      .mockResolvedValueOnce([{ now: clockAt }]),
    mineralEconomyCutover: {
      findUnique: vi.fn().mockResolvedValue({ id: 1, cutoverAt: CUTOVER }),
      create: vi.fn().mockResolvedValue({ id: 1, cutoverAt: CUTOVER }),
    },
    mineralAccount: {
      findUnique: vi.fn().mockResolvedValue(account),
      upsert: vi.fn().mockResolvedValue(account),
      update: vi.fn().mockImplementation(({ data }: { data: Partial<typeof account> }) => {
        Object.assign(account, data);
        return account;
      }),
    },
    backendPlanet: {
      findUnique: vi.fn().mockResolvedValue(planet),
      findMany: vi.fn().mockResolvedValue([planet]),
      update: vi.fn().mockImplementation(({ data }: { data: Partial<typeof planet> }) => {
        Object.assign(planet, data);
        return planet;
      }),
    },
    planetUpgradePurchase: {
      findUnique: vi.fn().mockResolvedValue(purchase),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => ({ id: 'purchase-1', ...data })),
    },
  };
  return {
    prisma: {
      $transaction: vi.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient,
    tx,
    account,
    planet,
  };
}

describe('mineral upgrade mutations', () => {
  it('keeps split account settlement equal to one continuous anchored settlement', async () => {
    const fixture = makePrisma({ account: { balanceMicros: 0n } });
    const firstAt = new Date('2026-08-20T12:34:56.789Z');
    const endAt = new Date('2026-08-21T00:00:00.001Z');
    const planet = makePlanet();
    const purchases = [{ planetId: planet.id, targetLevel: 1, bonusBpsAfter: 1_000, purchasedAt: firstAt }];
    const first = await settleMineralAccount({
      prisma: fixture.tx as never,
      account: fixture.account,
      planets: [planet],
      purchases,
      settledAt: firstAt,
      anchor: CUTOVER,
    });
    const second = await settleMineralAccount({
      prisma: fixture.tx as never,
      account: first,
      planets: [planet],
      purchases,
      settledAt: endAt,
      anchor: CUTOVER,
    });
    const whole = makePrisma({ account: { balanceMicros: 0n } });
    const continuous = await settleMineralAccount({
      prisma: whole.tx as never,
      account: whole.account,
      planets: [planet],
      purchases,
      settledAt: endAt,
      anchor: CUTOVER,
    });

    expect(second.balanceMicros).toBe(continuous.balanceMicros);
    expect(second.balanceMicros).toBe(1_047_573n);
  });

  it('leaves account, Planet, and purchase unchanged when funds are insufficient', async () => {
    const fixture = makePrisma({ account: { balanceMicros: 0n }, clockAt: CUTOVER });

    await expect(
      purchasePlanetUpgrade(fixture.prisma, {
        planetId: 'planet-1',
        targetLevel: 1,
        cutoverAt: CUTOVER,
        now: () => CUTOVER,
      }),
    ).rejects.toThrow('Insufficient mineral balance');

    expect(fixture.tx.mineralAccount.update).not.toHaveBeenCalled();
    expect(fixture.tx.backendPlanet.update).not.toHaveBeenCalled();
    expect(fixture.tx.planetUpgradePurchase.create).not.toHaveBeenCalled();
    expect(fixture.account.balanceMicros).toBe(0n);
    expect(fixture.planet.upgradeLevel).toBe(0);
  });

  it('returns an existing purchase on retry without debiting again', async () => {
    const first = makePrisma();
    const appClock = vi.fn(() => new Date('2099-01-01T00:00:00.000Z'));
    const result = await purchasePlanetUpgrade(first.prisma, {
      planetId: 'planet-1',
      targetLevel: 1,
      cutoverAt: CUTOVER,
      now: appClock,
    });
    const persisted = first.tx.planetUpgradePurchase.create.mock.results[0]?.value;
    expect(result).toMatchObject({ targetLevel: 1, costMicros: '200000' });
    expect(persisted.purchasedAt).toBe(PURCHASED_AT);
    expect(appClock).not.toHaveBeenCalled();
    expect(first.tx.mineralAccount.update).toHaveBeenCalledTimes(2);
    expect(first.tx.planetUpgradePurchase.create).toHaveBeenCalledOnce();

    const retry = makePrisma({ existingPurchase: persisted });
    const retryResult = await purchasePlanetUpgrade(retry.prisma, {
      planetId: 'planet-1',
      targetLevel: 1,
      cutoverAt: CUTOVER,
      now: () => new Date('2026-08-21T00:00:01.000Z'),
    });
    expect(retryResult).toMatchObject({ targetLevel: 1, costMicros: '200000' });
    expect(retry.tx.mineralAccount.update).not.toHaveBeenCalled();
    expect(retry.tx.backendPlanet.update).not.toHaveBeenCalled();
    expect(retry.tx.planetUpgradePurchase.create).not.toHaveBeenCalled();
  });
});
