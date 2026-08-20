import { PrismaPg } from '@prisma/adapter-pg';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { Prisma, PrismaClient } from './generated/prisma/client.js';
import { MEGASTERA_SOURCE } from './config.js';
import { purchasePlanetUpgrade } from './mineralAccounts.js';

const testDatabaseUrl = process.env.MINERAL_ECONOMY_TEST_DATABASE_URL?.trim();
const describePostgres = testDatabaseUrl ? describe : describe.skip;
const OWNER = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const CUTOVER = new Date('2026-08-20T00:00:00.000Z');
const PURCHASED_AT = new Date('2026-08-21T00:00:00.000Z');

function createClient() {
  if (!testDatabaseUrl) throw new Error('The explicit mineral economy test database is not configured.');
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: testDatabaseUrl, max: 1 }),
  });
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

  afterAll(async () => {
    await Promise.all([first.$disconnect(), second.$disconnect(), blocker.$disconnect()]);
  });

  it('charges one concurrent upgrade exactly once', async () => {
    const ticket = await first.ticketPurchase.create({
      data: {
        chainId: 8453,
        jackpotAddress: `0x${'11'.repeat(20)}`,
        ticketId: '99001',
        drawingId: '99001',
        recipient: OWNER,
        normals: [1, 2, 3, 4, 5],
        bonusBall: 6,
        source: MEGASTERA_SOURCE.padEnd(66, '0'),
        originTxHash: `0x${'12'.repeat(32)}`,
        blockNumber: 30_000_000n,
        blockHash: `0x${'13'.repeat(32)}`,
        logIndex: 99001,
        purchasedAt: CUTOVER,
      },
    });
    const planet = await first.backendPlanet.create({
      data: {
        ticketPurchaseId: ticket.id,
        chainId: 8453,
        ticketId: '99001',
        ownerAddress: OWNER,
        seed: `0x${'21'.repeat(32)}`,
        traitsHash: `0x${'22'.repeat(32)}`,
        generatorVersion: 1,
        planetName: 'Concurrency Planet',
        planetType: 'Gaia',
        terrain: 'Plains',
        rarity: 'Common',
        satelliteCount: 0,
        hasRing: false,
        baseMineralsPerDay: 1n,
        generatedAt: CUTOVER,
        status: 'READY',
        gifData: Buffer.from('gif'),
        gifHash: `0x${'23'.repeat(32)}`,
      },
    });
    await first.mineralAccount.create({
      data: {
        ownerAddress: OWNER,
        openingBalanceMicros: 500_000n,
        balanceMicros: 500_000n,
        lastSettledAt: PURCHASED_AT,
      },
    });

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
        planetId: planet.id,
        targetLevel: 1,
        cutoverAt: CUTOVER,
        now: () => PURCHASED_AT,
      }).then((result) => {
        completed += 1;
        return result;
      });
      const secondUpgrade = purchasePlanetUpgrade(second, {
        planetId: planet.id,
        targetLevel: 1,
        cutoverAt: CUTOVER,
        now: () => PURCHASED_AT,
      }).then((result) => {
        completed += 1;
        return result;
      });
      await new Promise((resolve) => setTimeout(resolve, 25));
      expect(completed).toBe(0);
      releaseLock();
      await blockerTransaction;

      const results = await Promise.all([
        firstUpgrade,
        secondUpgrade,
      ]);

      expect(results[0]?.targetLevel).toBe(1);
      expect(results[1]?.targetLevel).toBe(1);
      expect(await first.planetUpgradePurchase.count({ where: { planetId: planet.id, targetLevel: 1 } })).toBe(1);
      expect((await first.mineralAccount.findUnique({ where: { ownerAddress: OWNER } }))?.balanceMicros).toBe(300_000n);
    } finally {
      await first.planetUpgradePurchase.deleteMany({ where: { planetId: planet.id } });
      await first.mineralAccount.delete({ where: { ownerAddress: OWNER } });
      await first.backendPlanet.delete({ where: { id: planet.id } });
      await first.ticketPurchase.delete({ where: { id: ticket.id } });
    }
  });
});
