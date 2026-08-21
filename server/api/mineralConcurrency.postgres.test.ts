import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaBackendPlanetStore } from './backendPlanet.js';
import { MEGASTERA_SOURCE } from './config.js';
import { Prisma, PrismaClient } from './generated/prisma/client.js';
import { finalizeLeaderboardPeriod } from './leaderboardStore.js';
import { calculateHistoricalProduction } from './mineralEconomy.js';
import { getBackendWalletMiningSnapshot } from './miningStore.js';
import {
  acquireMineralEconomyExclusiveBarrier,
  acquireMineralEconomySharedBarrier,
  acquireMineralWalletLock,
  purchasePlanetUpgrade,
  resolveMineralEconomyCutover,
  runMineralAccountsBackfill,
} from './mineralAccounts.js';

const testDatabaseUrl = process.env.MINERAL_ECONOMY_TEST_DATABASE_URL?.trim();
if (!testDatabaseUrl && process.env.MINERAL_ECONOMY_REQUIRE_POSTGRES === '1') {
  throw new Error(
    'MINERAL_ECONOMY_TEST_DATABASE_URL is required for the PostgreSQL concurrency suite.',
  );
}
const describePostgres = testDatabaseUrl ? describe : describe.skip;
const OWNER = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
let nextFixtureId = 99_001;

function createClient() {
  if (!testDatabaseUrl)
    throw new Error('The explicit mineral economy test database is not configured.');
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: testDatabaseUrl, max: 1 }),
  });
}

async function postgresNow(prisma: PrismaClient): Promise<Date> {
  const rows = await prisma.$queryRaw<Array<{ now: Date }>>(
    Prisma.sql`SELECT clock_timestamp()::timestamptz(3) AS "now"`,
  );
  const value = rows[0]?.now;
  if (!(value instanceof Date) || !Number.isFinite(value.getTime()))
    throw new Error('PostgreSQL time is invalid.');
  return value;
}

function utcMidnightBefore(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate() - 1));
}

function utcMidnightAfter(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate() + 1));
}

function repeatedHex(value: number): `0x${string}` {
  const byte = (value % 256).toString(16).padStart(2, '0');
  return `0x${byte.repeat(32)}` as `0x${string}`;
}

async function createTicket(prisma: PrismaClient, ownerAddress: string, purchasedAt: Date) {
  const fixtureId = nextFixtureId++;
  const ticket = await prisma.ticketPurchase.create({
    data: {
      chainId: 8453,
      jackpotAddress: `0x${'11'.repeat(20)}`,
      ticketId: fixtureId.toString(),
      drawingId: fixtureId.toString(),
      recipient: ownerAddress,
      normals: [1, 2, 3, 4, 5],
      bonusBall: 6,
      source: MEGASTERA_SOURCE.padEnd(66, '0'),
      originTxHash: repeatedHex(fixtureId),
      blockNumber: BigInt(30_000_000 + fixtureId),
      blockHash: repeatedHex(fixtureId + 1),
      logIndex: fixtureId,
      purchasedAt,
    },
  });
  return { ticket, fixtureId };
}

async function createFixture(
  prisma: PrismaClient,
  ownerAddress: string,
  generatedAt: Date,
  baseMineralsPerDay = 1n,
) {
  const { ticket, fixtureId } = await createTicket(prisma, ownerAddress, generatedAt);
  const planet = await prisma.backendPlanet.create({
    data: {
      ticketPurchaseId: ticket.id,
      chainId: 8453,
      ticketId: fixtureId.toString(),
      ownerAddress,
      seed: repeatedHex(fixtureId + 2),
      traitsHash: repeatedHex(fixtureId + 3),
      generatorVersion: 1,
      planetName: `Concurrency Planet ${fixtureId}`,
      planetType: 'Gaia',
      terrain: 'Plains',
      rarity: 'Common',
      satelliteCount: 0,
      hasRing: false,
      baseMineralsPerDay,
      generatedAt,
      status: 'READY',
      gifData: Buffer.from('gif'),
      gifHash: repeatedHex(fixtureId + 4),
    },
  });
  return { ticket, planet, fixtureId };
}

async function seedAccount(prisma: PrismaClient, ownerAddress: string, lastSettledAt: Date) {
  return prisma.mineralAccount.create({
    data: {
      ownerAddress,
      openingBalanceMicros: 10_000_000n,
      balanceMicros: 10_000_000n,
      lastSettledAt,
    },
  });
}

function proofForTicket(
  ticket: Awaited<ReturnType<typeof createTicket>>['ticket'],
  ownerAddress: string,
) {
  return {
    chainId: 8453,
    recipient: ownerAddress as `0x${string}`,
    ticketId: BigInt(ticket.ticketId.toString()),
    drawingId: BigInt(ticket.drawingId.toString()),
    normals: ticket.normals,
    bonusBall: ticket.bonusBall,
    originTxHash: ticket.originTxHash as `0x${string}`,
    blockNumber: ticket.blockNumber,
    blockHash: ticket.blockHash as `0x${string}`,
    logIndex: BigInt(ticket.logIndex),
    purchasedAt: ticket.purchasedAt,
  } as const;
}

async function clearTestDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.leaderboardEntry.deleteMany();
  await prisma.leaderboardPeriod.deleteMany();
  // Upgrade history is immutable in production; TRUNCATE keeps test cleanup read/write-safe without firing delete triggers.
  await prisma.$executeRaw(Prisma.sql`TRUNCATE TABLE "planet_upgrade_purchases", "mineral_economy_cutover"`);
  await prisma.mineralAccount.deleteMany();
  await prisma.backendPlanet.deleteMany();
  await prisma.ticketPurchase.deleteMany();
}

async function ensurePersistedCutover(prisma: PrismaClient, cutoverAt: Date): Promise<Date> {
  const existing = await prisma.mineralEconomyCutover.findUnique({ where: { id: 1 } });
  if (!existing) {
    await prisma.mineralEconomyCutover.create({ data: { id: 1, cutoverAt } });
    return cutoverAt;
  }
  return existing.cutoverAt;
}

describePostgres('Mineral upgrade PostgreSQL concurrency', () => {
  let first: PrismaClient;
  let second: PrismaClient;
  let blocker: PrismaClient;

  beforeAll(() => {
    first = createClient();
    second = createClient();
    blocker = createClient();
  });

  beforeEach(async () => {
    await clearTestDatabase(first);
  });

  afterAll(async () => {
    await Promise.all([first.$disconnect(), second.$disconnect(), blocker.$disconnect()]);
  });

  it('fails a configured but unpersisted cutover after PostgreSQL reaches T', async () => {
    const databaseNow = await postgresNow(first);
    const cutoverAt = utcMidnightBefore(databaseNow);

    await expect(
      getBackendWalletMiningSnapshot(first, OWNER, databaseNow, {
        mineralEconomyCutoverAt: cutoverAt,
      }),
    ).rejects.toThrow('configured mineral economy cutover is not persisted');
  });

  it('enforces immutable history/account identity while allowing READY Planet upgrades and media repair', async () => {
    const databaseNow = await postgresNow(first);
    const cutoverAt = await ensurePersistedCutover(first, utcMidnightBefore(databaseNow));
    const fixture = await createFixture(first, OWNER, cutoverAt);
    await seedAccount(first, OWNER, databaseNow);
    const purchase = await first.planetUpgradePurchase.create({
      data: {
        planetId: fixture.planet.id,
        walletAddress: OWNER,
        targetLevel: 1,
        bonusBpsAfter: 1_000,
        costMicros: 200_000n,
        purchasedAt: databaseNow,
      },
    });

    await expect(
      first.planetUpgradePurchase.update({ where: { id: purchase.id }, data: { costMicros: 1n } }),
    ).rejects.toThrow('immutable');
    await expect(first.planetUpgradePurchase.delete({ where: { id: purchase.id } })).rejects.toThrow('immutable');
    await expect(
      first.mineralAccount.update({ where: { ownerAddress: OWNER }, data: { openingBalanceMicros: 1n } }),
    ).rejects.toThrow('immutable');
    await expect(
      first.backendPlanet.update({ where: { id: fixture.planet.id }, data: { baseMineralsPerDay: 2n } }),
    ).rejects.toThrow('immutable');
    await expect(
      first.backendPlanet.update({
        where: { id: fixture.planet.id },
        data: { upgradeLevel: 1, upgradeBonusBps: 1_000, gifData: Buffer.from('repaired') },
      }),
    ).resolves.toBeTruthy();
  });

  it('persists a pre-cutover generation without creating a V2 account', async () => {
    const databaseNow = await postgresNow(first);
    const cutoverAt = utcMidnightAfter(databaseNow);
    const ticket = await createTicket(first, OWNER, databaseNow);

    const generated = await new PrismaBackendPlanetStore(
      first,
      () => databaseNow,
      cutoverAt,
    ).generatePlanet(proofForTicket(ticket.ticket, OWNER));

    expect(new Date(generated.generatedAt).getTime()).toBeLessThan(cutoverAt.getTime());
    expect(await first.backendPlanet.count({ where: { ticketPurchaseId: ticket.ticket.id } })).toBe(
      1,
    );
    expect(await first.mineralAccount.findUnique({ where: { ownerAddress: OWNER } })).toBeNull();
    expect(await first.mineralEconomyCutover.findUnique({ where: { id: 1 } })).toBeNull();
  });

  it('charges one concurrent upgrade exactly once', async () => {
    const databaseNow = await postgresNow(first);
    const cutoverAt = await ensurePersistedCutover(first, utcMidnightBefore(databaseNow));
    const fixture = await createFixture(first, OWNER, cutoverAt);
    await seedAccount(first, OWNER, databaseNow);

    try {
      let releaseLock!: () => void;
      const releasePromise = new Promise<void>((resolve) => {
        releaseLock = resolve;
      });
      let lockHeld!: () => void;
      const lockHeldPromise = new Promise<void>((resolve) => {
        lockHeld = resolve;
      });
      const blockerTransaction = blocker.$transaction(async (transaction) => {
        await transaction.$queryRaw(
          Prisma.sql`SELECT "id" FROM "mineral_accounts" WHERE "ownerAddress" = ${OWNER} FOR UPDATE`,
        );
        lockHeld();
        await releasePromise;
      });
      await lockHeldPromise;

      let completed = 0;
      const firstUpgrade = purchasePlanetUpgrade(first, {
        planetId: fixture.planet.id,
        targetLevel: 1,
        cutoverAt,
      }).then((result) => {
        completed += 1;
        return result;
      });
      const secondUpgrade = purchasePlanetUpgrade(second, {
        planetId: fixture.planet.id,
        targetLevel: 1,
        cutoverAt,
      }).then((result) => {
        completed += 1;
        return result;
      });
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(completed).toBe(0);
      releaseLock();
      await blockerTransaction;

      const results = await Promise.all([firstUpgrade, secondUpgrade]);

      expect(results[0]?.targetLevel).toBe(1);
      expect(results[1]?.targetLevel).toBe(1);
      expect(
        await first.planetUpgradePurchase.count({
          where: { planetId: fixture.planet.id, targetLevel: 1 },
        }),
      ).toBe(1);
      const balance = (await first.mineralAccount.findUnique({ where: { ownerAddress: OWNER } }))
        ?.balanceMicros;
      expect(balance).toBeGreaterThanOrEqual(9_800_000n);
      expect(balance).toBeLessThan(10_000_000n);
    } finally {
      await clearTestDatabase(first);
    }
  });

  it('serializes different Planet upgrades for one wallet', async () => {
    const databaseNow = await postgresNow(first);
    const cutoverAt = await ensurePersistedCutover(first, utcMidnightBefore(databaseNow));
    const firstFixture = await createFixture(first, OWNER, cutoverAt);
    const secondFixture = await createFixture(first, OWNER, cutoverAt);
    await seedAccount(first, OWNER, databaseNow);

    const [firstPurchase, secondPurchase] = await Promise.all([
      purchasePlanetUpgrade(first, { planetId: firstFixture.planet.id, targetLevel: 1, cutoverAt }),
      purchasePlanetUpgrade(second, {
        planetId: secondFixture.planet.id,
        targetLevel: 1,
        cutoverAt,
      }),
    ]);

    expect(firstPurchase.targetLevel).toBe(1);
    expect(secondPurchase.targetLevel).toBe(1);
    expect(await first.planetUpgradePurchase.count({ where: { walletAddress: OWNER } })).toBe(2);
    const balance = (await first.mineralAccount.findUnique({ where: { ownerAddress: OWNER } }))
      ?.balanceMicros;
    expect(balance).toBeGreaterThanOrEqual(9_600_000n);
    expect(balance).toBeLessThan(10_000_000n);
  });

  it('orders generation and upgrade through the shared economy barrier', async () => {
    const databaseNow = await postgresNow(first);
    const cutoverAt = await ensurePersistedCutover(first, utcMidnightBefore(databaseNow));
    const existing = await createFixture(first, OWNER, cutoverAt);
    const generationTicket = await createTicket(first, OWNER, cutoverAt);
    await seedAccount(first, OWNER, databaseNow);

    const generation = new PrismaBackendPlanetStore(
      second,
      () => databaseNow,
      cutoverAt,
    ).generatePlanet(proofForTicket(generationTicket.ticket, OWNER));
    const upgrade = purchasePlanetUpgrade(first, {
      planetId: existing.planet.id,
      targetLevel: 1,
      cutoverAt,
    });
    const [generated, purchase] = await Promise.all([generation, upgrade]);

    expect(generated.status).toBe('READY');
    expect(purchase.targetLevel).toBe(1);
    expect(
      await first.backendPlanet.count({ where: { ownerAddress: OWNER, status: 'READY' } }),
    ).toBe(2);
    expect(await first.planetUpgradePurchase.count({ where: { walletAddress: OWNER } })).toBe(1);
  });

  it('serializes two concurrent generations for one wallet', async () => {
    const databaseNow = await postgresNow(first);
    const cutoverAt = await ensurePersistedCutover(first, utcMidnightBefore(databaseNow));
    const firstTicket = await createTicket(first, OWNER, cutoverAt);
    const secondTicket = await createTicket(first, OWNER, cutoverAt);
    await seedAccount(first, OWNER, databaseNow);

    const [firstPlanet, secondPlanet] = await Promise.all([
      new PrismaBackendPlanetStore(first, () => databaseNow, cutoverAt).generatePlanet(
        proofForTicket(firstTicket.ticket, OWNER),
      ),
      new PrismaBackendPlanetStore(second, () => databaseNow, cutoverAt).generatePlanet(
        proofForTicket(secondTicket.ticket, OWNER),
      ),
    ]);

    expect(firstPlanet.status).toBe('READY');
    expect(secondPlanet.status).toBe('READY');
    expect(
      await first.backendPlanet.count({ where: { ownerAddress: OWNER, status: 'READY' } }),
    ).toBe(2);
    expect(await first.mineralAccount.count({ where: { ownerAddress: OWNER } })).toBe(1);
    const account = await first.mineralAccount.findUnique({ where: { ownerAddress: OWNER } });
    const planets = await first.backendPlanet.findMany({
      where: { ownerAddress: OWNER, status: 'READY' },
      select: {
        id: true,
        ownerAddress: true,
        planetType: true,
        baseMineralsPerDay: true,
        generatedAt: true,
      },
    });
    expect(account?.balanceMicros).toBe(
      10_000_000n + calculateHistoricalProduction({
        planets,
        purchases: [],
        from: databaseNow,
        to: account?.lastSettledAt ?? databaseNow,
        anchor: cutoverAt,
      }),
    );
  });

  it('timestamps generation after waiting on the wallet lock', async () => {
    const databaseNow = await postgresNow(first);
    const cutoverAt = await ensurePersistedCutover(first, utcMidnightBefore(databaseNow));
    const ticket = await createTicket(first, OWNER, databaseNow);
    await seedAccount(first, OWNER, databaseNow);

    let releaseWallet!: () => void;
    const release = new Promise<void>((resolve) => {
      releaseWallet = resolve;
    });
    let walletHeld!: () => void;
    const held = new Promise<void>((resolve) => {
      walletHeld = resolve;
    });
    const blockerTransaction = blocker.$transaction(async (transaction) => {
      await acquireMineralEconomySharedBarrier(transaction);
      await acquireMineralWalletLock(transaction, OWNER);
      walletHeld();
      await release;
    });
    await held;

    let completed = false;
    const generation = new PrismaBackendPlanetStore(
      second,
      () => databaseNow,
      cutoverAt,
    ).generatePlanet(proofForTicket(ticket.ticket, OWNER)).then((result) => {
      completed = true;
      return result;
    });
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(completed).toBe(false);
    const releasedAt = await postgresNow(first);
    releaseWallet();
    await Promise.all([blockerTransaction, generation]);

    const generated = await first.backendPlanet.findUnique({
      where: { ticketPurchaseId: ticket.ticket.id },
    });
    expect(generated?.generatedAt.getTime()).toBeGreaterThanOrEqual(releasedAt.getTime());
    const account = await first.mineralAccount.findUnique({ where: { ownerAddress: OWNER } });
    const planets = await first.backendPlanet.findMany({
      where: { ownerAddress: OWNER, status: 'READY' },
      select: {
        id: true,
        ownerAddress: true,
        planetType: true,
        baseMineralsPerDay: true,
        generatedAt: true,
      },
    });
    expect(account?.balanceMicros).toBe(
      10_000_000n + calculateHistoricalProduction({
        planets,
        purchases: [],
        from: databaseNow,
        to: account?.lastSettledAt ?? databaseNow,
        anchor: cutoverAt,
      }),
    );
  });

  it('keeps backfill and in-flight generation ordered by the economy barrier', async () => {
    const databaseNow = await postgresNow(first);
    const cutoverAt = await ensurePersistedCutover(first, utcMidnightBefore(databaseNow));
    const ticket = await createTicket(first, OWNER, cutoverAt);

    let releaseBarrier!: () => void;
    const release = new Promise<void>((resolve) => {
      releaseBarrier = resolve;
    });
    let barrierHeld!: () => void;
    const held = new Promise<void>((resolve) => {
      barrierHeld = resolve;
    });
    const blockerTransaction = blocker.$transaction(async (transaction) => {
      await acquireMineralEconomyExclusiveBarrier(transaction);
      barrierHeld();
      await release;
    });
    await held;

    const generation = new PrismaBackendPlanetStore(
      second,
      () => databaseNow,
      cutoverAt,
    ).generatePlanet(proofForTicket(ticket.ticket, OWNER));
    const backfill = runMineralAccountsBackfill(first, cutoverAt);
    releaseBarrier();
    await Promise.all([blockerTransaction, generation, backfill]);

    expect(
      await first.backendPlanet.count({ where: { ownerAddress: OWNER, status: 'READY' } }),
    ).toBe(1);
    expect(await first.mineralAccount.count({ where: { ownerAddress: OWNER } })).toBe(1);
  });

  it('lets finalization drain a late pre-boundary mutation before its snapshot', async () => {
    const databaseNow = await postgresNow(first);
    const cutoverAt = utcMidnightBefore(databaseNow);
    const fixture = await createFixture(first, OWNER, cutoverAt);
    await seedAccount(first, OWNER, databaseNow);
    const persistedCutoverAt = await ensurePersistedCutover(first, cutoverAt);
    const period = {
      id: persistedCutoverAt.toISOString().slice(0, 10),
      startsAt: persistedCutoverAt,
      endsAt: new Date(persistedCutoverAt.getTime() + 86_400_000),
    };

    let releaseMutation!: () => void;
    const release = new Promise<void>((resolve) => {
      releaseMutation = resolve;
    });
    let mutationHeld!: () => void;
    const held = new Promise<void>((resolve) => {
      mutationHeld = resolve;
    });
    const mutation = first.$transaction(async (transaction) => {
      await acquireMineralEconomySharedBarrier(transaction);
      mutationHeld();
      await release;
      await transaction.planetUpgradePurchase.create({
        data: {
          planetId: fixture.planet.id,
          walletAddress: OWNER,
          targetLevel: 1,
          bonusBpsAfter: 1_000,
          costMicros: 200_000n,
          purchasedAt: new Date(period.endsAt.getTime() - 1),
        },
      });
    });
    await held;
    let finalized = false;
    const finalization = finalizeLeaderboardPeriod(second, period, databaseNow, {
      mineralEconomyCutoverAt: persistedCutoverAt,
    }).then((result) => {
      finalized = true;
      return result;
    });
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(finalized).toBe(false);
    releaseMutation();
    await Promise.all([mutation, finalization]);

    expect(
      await first.planetUpgradePurchase.count({ where: { planetId: fixture.planet.id } }),
    ).toBe(1);
    expect(
      (await first.leaderboardPeriod.findUnique({ where: { id: period.id } }))?.finalizedAt,
    ).not.toBeNull();
    const archived = await first.leaderboardEntry.findUnique({
      where: { periodId_walletAddress: { periodId: period.id, walletAddress: OWNER } },
    });
    expect(archived?.scoreMicros).toBe(10_800_000n);
  });

  it('uses a persisted cutover when configuration is missing', async () => {
    const cutoverAt = await ensurePersistedCutover(
      first,
      utcMidnightBefore(await postgresNow(first)),
    );

    await expect(resolveMineralEconomyCutover(first, null)).resolves.toEqual({
      state: 'V2',
      cutoverAt,
      source: 'database',
    });
  });

  it('fails closed when configured and persisted cutovers conflict', async () => {
    const persistedCutoverAt = await ensurePersistedCutover(
      first,
      utcMidnightBefore(await postgresNow(first)),
    );

    await expect(
      resolveMineralEconomyCutover(first, new Date(persistedCutoverAt.getTime() - 86_400_000)),
    ).rejects.toThrow('conflicts with the persisted database cutover');
  });
});
