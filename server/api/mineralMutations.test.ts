import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from './generated/prisma/client.js';
import { calculateEffectiveMineralsPerDayMicros } from './collectionMining.js';
import { BASE_CHAIN_ID } from './config.js';
import { BASE_JACKPOT } from './eligibility.js';
import { aggregateGalaxyPulseByType, deriveGalaxyPulseV1 } from './galaxyPulse.js';
import { purchasePlanetUpgrade, settleMineralAccount } from './mineralAccounts.js';

const OWNER = '0x1111111111111111111111111111111111111111';
const OTHER = '0x2222222222222222222222222222222222222222';
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
  pulseRows?: Array<{ drawingId: bigint; entropy: `0x${string}`; settledAt: Date }>;
} = {}) {
  const planet = makePlanet();
  const balanceMicros = typeof overrides.account?.balanceMicros === 'bigint' ? overrides.account.balanceMicros : 500_000n;
  const lastSettledAt = overrides.account?.lastSettledAt instanceof Date ? overrides.account.lastSettledAt : CUTOVER;
  const account = {
    id: 'account-1',
    ownerAddress: typeof overrides.account?.ownerAddress === 'string' ? overrides.account.ownerAddress : OWNER,
    openingBalanceMicros: 0n,
    balanceMicros,
    lastSettledAt,
  };
  const purchase = overrides.existingPurchase ?? null;
  const clockAt = overrides.clockAt ?? PURCHASED_AT;
  const events: string[] = [];
  let queryIndex = 0;
  const tx = {
    $queryRaw: vi.fn().mockImplementation(() => {
      queryIndex += 1;
      if (queryIndex === 1) {
        events.push('economy-lock');
        return [{ locked: 1 }];
      }
      if (queryIndex === 2) {
        events.push('wallet-lock');
        return [{ locked: 1 }];
      }
      if (queryIndex === 3) {
        events.push('clock');
        return [{ now: clockAt }];
      }
      events.push('planet-lock');
      return [{ id: planet.id }];
    }),
    mineralEconomyCutover: {
      findUnique: vi.fn().mockResolvedValue({ id: 1, cutoverAt: CUTOVER }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
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
      findUnique: vi.fn().mockImplementation(() => {
        events.push('planet-read');
        return planet;
      }),
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
    galaxyPulseRound: { findMany: vi.fn().mockResolvedValue(overrides.pulseRows ?? []) },
  };
  return {
    prisma: {
      $transaction: vi.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient,
    tx,
    account,
    events,
    planet,
  };
}

describe('mineral upgrade mutations', () => {
  it('loads authoritative Pulse rounds before fixing an account balance', async () => {
    const pulse = {
      drawingId: 150n,
      entropy: `0x${'33'.repeat(32)}` as const,
      settledAt: CUTOVER,
    };
    const fixture = makePrisma({ account: { balanceMicros: 0n }, pulseRows: [pulse] });
    const pulseBps = aggregateGalaxyPulseByType(deriveGalaxyPulseV1({
      drawingId: pulse.drawingId,
      entropy: pulse.entropy,
      chainId: BASE_CHAIN_ID,
      jackpotAddress: BASE_JACKPOT,
    })).get('gaia') ?? 0;

    const settled = await settleMineralAccount({
      prisma: fixture.tx as never,
      account: fixture.account,
      planets: [makePlanet()],
      purchases: [],
      settledAt: PURCHASED_AT,
      anchor: CUTOVER,
    });

    expect(settled.balanceMicros).toBe(calculateEffectiveMineralsPerDayMicros(1n, pulseBps));
    expect(fixture.tx.galaxyPulseRound.findMany).toHaveBeenCalledOnce();
  });

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
        authenticatedWalletAddress: OWNER,
        planetId: 'planet-1',
        targetLevel: 1,
        cutoverAt: CUTOVER,
      }),
    ).rejects.toThrow('Insufficient mineral balance');

    expect(fixture.tx.mineralAccount.update).not.toHaveBeenCalled();
    expect(fixture.tx.backendPlanet.update).not.toHaveBeenCalled();
    expect(fixture.tx.planetUpgradePurchase.create).not.toHaveBeenCalled();
    expect(fixture.account.balanceMicros).toBe(0n);
    expect(fixture.planet.upgradeLevel).toBe(0);
  });

  it('checks the authenticated owner only after locking the Planet', async () => {
    const fixture = makePrisma({ account: { ownerAddress: OTHER } });

    await expect(
      purchasePlanetUpgrade(fixture.prisma, {
        authenticatedWalletAddress: OTHER,
        planetId: 'planet-1',
        targetLevel: 1,
        cutoverAt: CUTOVER,
      }),
    ).rejects.toThrow('Authenticated wallet does not own this Planet');

    expect(fixture.tx.backendPlanet.findUnique).toHaveBeenCalledOnce();
    expect(fixture.events.indexOf('planet-lock')).toBeLessThan(fixture.events.indexOf('planet-read'));
    expect(fixture.tx.backendPlanet.findMany).not.toHaveBeenCalled();
    expect(fixture.tx.mineralAccount.update).not.toHaveBeenCalled();
    expect(fixture.tx.backendPlanet.update).not.toHaveBeenCalled();
    expect(fixture.tx.planetUpgradePurchase.create).not.toHaveBeenCalled();
  });

  it('returns an existing purchase on retry without debiting again', async () => {
    const first = makePrisma();
    const result = await purchasePlanetUpgrade(first.prisma, {
      authenticatedWalletAddress: OWNER,
      planetId: 'planet-1',
      targetLevel: 1,
      cutoverAt: CUTOVER,
    });
    const persisted = first.tx.planetUpgradePurchase.create.mock.results[0]?.value;
    expect(result).toMatchObject({ targetLevel: 1, costMicros: '200000' });
    expect(result).not.toHaveProperty('currentBalanceMicros');
    expect(persisted.purchasedAt).toBe(PURCHASED_AT);
    expect(first.tx.mineralAccount.update).toHaveBeenCalledTimes(2);
    expect(first.tx.planetUpgradePurchase.create).toHaveBeenCalledOnce();

    const retry = makePrisma({
      existingPurchase: persisted,
      account: {
        balanceMicros: first.account.balanceMicros,
        lastSettledAt: PURCHASED_AT,
      },
    });
    const retryResult = await purchasePlanetUpgrade(retry.prisma, {
      authenticatedWalletAddress: OWNER,
      planetId: 'planet-1',
      targetLevel: 1,
      cutoverAt: CUTOVER,
    });
    expect(retryResult).toEqual(result);
    expect(retryResult).not.toHaveProperty('currentBalanceMicros');
    expect(retry.tx.mineralAccount.update).not.toHaveBeenCalled();
    expect(retry.tx.backendPlanet.update).not.toHaveBeenCalled();
    expect(retry.tx.planetUpgradePurchase.create).not.toHaveBeenCalled();
  });
});
