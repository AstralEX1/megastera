import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from './generated/prisma/client.js';
import { PrismaBackendPlanetStore } from './backendPlanet.js';
import type { MegasteraProof } from './eligibility.js';

const proof = {
  recipient: '0x1111111111111111111111111111111111111111',
  ticketId: 1n,
  drawingId: 1n,
  normals: [1, 2, 3, 4, 5],
  bonusBall: 6,
  originTxHash: `0x${'11'.repeat(32)}`,
  blockNumber: 30_000_000n,
  logIndex: 0n,
  blockHash: `0x${'22'.repeat(32)}`,
} as unknown as MegasteraProof;

describe('PrismaBackendPlanetStore', () => {
  it('rejects a receipt proof that is not persisted', async () => {
    const prisma = {
      ticketPurchase: { findUnique: vi.fn().mockResolvedValue(null) },
      backendPlanet: { findUnique: vi.fn() },
    } as unknown as PrismaClient;
    const store = new PrismaBackendPlanetStore(prisma);

    await expect(store.generatePlanet(proof)).rejects.toThrow('proof is not persisted');
    expect(prisma.ticketPurchase.findUnique).toHaveBeenCalledOnce();
  });

  it('rejects proof fields that conflict with the persisted receipt row', async () => {
    const prisma = {
      ticketPurchase: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'ticket-row',
          ticketId: { toFixed: () => '999' },
          drawingId: { toFixed: () => '1' },
          recipient: proof.recipient,
          bonusBall: proof.bonusBall,
          normals: proof.normals,
        }),
      },
      backendPlanet: { findUnique: vi.fn() },
    } as unknown as PrismaClient;
    const store = new PrismaBackendPlanetStore(prisma);

    await expect(store.generatePlanet(proof)).rejects.toThrow('conflicts with persisted ticket');
  });

  it('returns the row won by a concurrent create instead of overwriting its generation time', async () => {
    const persistedTicket = {
      id: 'ticket-row',
      ticketId: { toFixed: () => '1' },
      drawingId: { toFixed: () => '1' },
      recipient: proof.recipient,
      bonusBall: proof.bonusBall,
      normals: proof.normals,
    };
    const existingPlanet = {
      id: 'planet-row',
      chainId: 8453,
      ticketId: { toFixed: () => '1' },
      ownerAddress: proof.recipient,
      planetName: 'Existing Planet',
      seed: `0x${'11'.repeat(32)}`,
      traitsHash: `0x${'22'.repeat(32)}`,
      generatorVersion: 1,
      planetType: 'Gaia',
      terrain: 'Plains',
      rarity: 'Common',
      satelliteCount: 0,
      hasRing: false,
      baseMineralsPerDay: 1n,
      generatedAt: new Date('2026-08-13T12:00:00.000Z'),
      status: 'READY',
      gifData: Buffer.from('gif'),
      gifHash: `0x${'33'.repeat(32)}`,
      ticketPurchase: {
        ticketId: { toFixed: () => '1' },
        drawingId: { toFixed: () => '1' },
        normals: proof.normals,
        bonusBall: proof.bonusBall,
        originTxHash: proof.originTxHash,
        logIndex: 0,
        purchasedAt: new Date('2026-08-13T11:00:00.000Z'),
      },
    };
    const prisma = {
      ticketPurchase: {
        findUnique: vi.fn().mockResolvedValue(persistedTicket),
      },
      backendPlanet: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(existingPlanet),
        create: vi.fn().mockRejectedValue({ code: 'P2002' }),
      },
    } as unknown as PrismaClient;
    const store = new PrismaBackendPlanetStore(prisma);

    await expect(store.generatePlanet(proof)).resolves.toMatchObject({
      planetId: 'planet-row',
      generatedAt: existingPlanet.generatedAt.toISOString(),
    });
    expect(prisma.backendPlanet.create).toHaveBeenCalledOnce();
  });

  it('returns the concurrent winner when configured future cutover falls back to V1 creation', async () => {
    const cutoverAt = new Date('2026-08-20T00:00:00.000Z');
    const draftAt = new Date('2026-08-19T00:00:00.000Z');
    const persistedTicket = {
      id: 'ticket-row',
      ticketId: { toFixed: () => '1' },
      drawingId: { toFixed: () => '1' },
      recipient: proof.recipient,
      bonusBall: proof.bonusBall,
      normals: proof.normals,
      originTxHash: proof.originTxHash,
      logIndex: 0,
      purchasedAt: new Date('2026-08-19T00:00:00.000Z'),
    };
    const winner = {
      id: 'winner-planet',
      chainId: 8453,
      ticketId: { toFixed: () => '1' },
      ownerAddress: proof.recipient,
      planetName: 'Winner Planet',
      seed: `0x${'11'.repeat(32)}`,
      traitsHash: `0x${'22'.repeat(32)}`,
      generatorVersion: 1,
      planetType: 'Gaia',
      terrain: 'Plains',
      rarity: 'Common',
      satelliteCount: 0,
      hasRing: false,
      baseMineralsPerDay: 1n,
      generatedAt: draftAt,
      status: 'READY' as const,
      gifData: Buffer.from('gif'),
      gifHash: `0x${'33'.repeat(32)}`,
      ticketPurchase: persistedTicket,
    };
    const account = {
      ownerAddress: proof.recipient.toLowerCase(),
      balanceMicros: 0n,
      lastSettledAt: cutoverAt,
    };
    const transaction = {
      mineralAccount: {
        findUnique: vi.fn().mockResolvedValue(account),
        upsert: vi.fn().mockResolvedValue(account),
      },
      backendPlanet: { findUnique: vi.fn().mockResolvedValue(null) },
    };
    let findCalls = 0;
    let createCalls = 0;
    let releaseCreates!: () => void;
    const bothCreates = new Promise<void>((resolve) => {
      releaseCreates = resolve;
    });
    const prisma = {
      ticketPurchase: { findUnique: vi.fn().mockResolvedValue(persistedTicket) },
      backendPlanet: {
        findUnique: vi.fn().mockImplementation(async () => {
          findCalls += 1;
          return findCalls <= 2 ? null : winner;
        }),
        create: vi.fn(async () => {
          const call = ++createCalls;
          if (call === 2) releaseCreates();
          await bothCreates;
          if (call === 1) return winner;
          throw { code: 'P2002' };
        }),
      },
      $transaction: vi.fn(async (callback: (value: typeof transaction) => unknown) => callback(transaction)),
    } as unknown as PrismaClient;
    const createNow = () => {
      let calls = 0;
      return () => (calls++ === 0 ? draftAt : draftAt);
    };
    const firstStore = new PrismaBackendPlanetStore(prisma, createNow(), cutoverAt);
    const secondStore = new PrismaBackendPlanetStore(prisma, createNow(), cutoverAt);

    const results = await Promise.all([
      firstStore.generatePlanet(proof),
      secondStore.generatePlanet(proof),
    ]);

    expect(results.map((result) => result.planetId)).toEqual(['winner-planet', 'winner-planet']);
    expect(prisma.backendPlanet.create).toHaveBeenCalledTimes(2);
    expect(prisma.backendPlanet.findUnique).toHaveBeenCalledTimes(3);
  });

  it('reloads the READY winner when a concurrent post-cutover transaction create loses P2002', async () => {
    const cutoverAt = new Date('2026-08-20T00:00:00.000Z');
    const effectiveAt = new Date('2026-08-21T00:00:00.000Z');
    const persistedTicket = {
      id: 'ticket-row',
      ticketId: { toFixed: () => '1' },
      drawingId: { toFixed: () => '1' },
      recipient: proof.recipient,
      bonusBall: proof.bonusBall,
      normals: proof.normals,
      originTxHash: proof.originTxHash,
      logIndex: 0,
      purchasedAt: new Date('2026-08-19T00:00:00.000Z'),
    };
    const winner = {
      id: 'winner-post-cutover-planet',
      chainId: 8453,
      ticketId: { toFixed: () => '1' },
      ownerAddress: proof.recipient,
      planetName: 'Post-cutover Winner Planet',
      seed: `0x${'11'.repeat(32)}`,
      traitsHash: `0x${'22'.repeat(32)}`,
      generatorVersion: 1,
      planetType: 'Gaia',
      terrain: 'Plains',
      rarity: 'Common',
      satelliteCount: 0,
      hasRing: false,
      baseMineralsPerDay: 1n,
      generatedAt: effectiveAt,
      status: 'READY' as const,
      gifData: Buffer.from('gif'),
      gifHash: `0x${'33'.repeat(32)}`,
      ticketPurchase: persistedTicket,
    };
    const account = {
      ownerAddress: proof.recipient.toLowerCase(),
      balanceMicros: 0n,
      lastSettledAt: effectiveAt,
    };
    let createCalls = 0;
    let releaseCreates!: () => void;
    const bothCreates = new Promise<void>((resolve) => {
      releaseCreates = resolve;
    });
    const transaction = {
      mineralAccount: {
        findUnique: vi.fn().mockResolvedValue(account),
        upsert: vi.fn().mockResolvedValue(account),
      },
      backendPlanet: {
        findUnique: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn(async () => {
          const call = ++createCalls;
          if (call === 2) releaseCreates();
          await bothCreates;
          if (call === 1) return winner;
          throw { code: 'P2002' };
        }),
      },
      planetUpgradePurchase: { findMany: vi.fn().mockResolvedValue([]) },
    };
    let findCalls = 0;
    const prisma = {
      ticketPurchase: { findUnique: vi.fn().mockResolvedValue(persistedTicket) },
      backendPlanet: {
        findUnique: vi.fn().mockImplementation(async () => {
          findCalls += 1;
          return findCalls <= 2 ? null : winner;
        }),
      },
      $transaction: vi.fn(async (callback: (client: typeof transaction) => unknown) => callback(transaction)),
    } as unknown as PrismaClient;
    const firstStore = new PrismaBackendPlanetStore(prisma, () => effectiveAt, cutoverAt);
    const secondStore = new PrismaBackendPlanetStore(prisma, () => effectiveAt, cutoverAt);

    const results = await Promise.all([
      firstStore.generatePlanet(proof),
      secondStore.generatePlanet(proof),
    ]);

    expect(results.map((result) => result.planetId)).toEqual([
      'winner-post-cutover-planet',
      'winner-post-cutover-planet',
    ]);
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(transaction.backendPlanet.create).toHaveBeenCalledTimes(2);
    expect(prisma.backendPlanet.findUnique).toHaveBeenCalledTimes(3);
  });

  it('settles existing production before activating a generated Planet at the locked effective time', async () => {
    const cutoverAt = new Date('2026-08-20T00:00:00.000Z');
    const draftAt = new Date('2026-08-19T00:00:00.000Z');
    const effectiveAt = new Date('2026-08-21T00:00:00.000Z');
    const persistedTicket = {
      id: 'ticket-row',
      ticketId: { toFixed: () => '1' },
      drawingId: { toFixed: () => '1' },
      recipient: proof.recipient,
      bonusBall: proof.bonusBall,
      normals: proof.normals,
      originTxHash: proof.originTxHash,
      logIndex: 0,
      purchasedAt: new Date('2026-08-19T00:00:00.000Z'),
    };
    const oldPlanet = {
      id: 'old-planet',
      ownerAddress: proof.recipient.toLowerCase(),
      planetType: 'Gaia',
      baseMineralsPerDay: 1n,
      generatedAt: cutoverAt,
      upgradeLevel: 0,
      upgradeBonusBps: 0,
      status: 'READY' as const,
    };
    const account = {
      id: 'account-row',
      ownerAddress: proof.recipient.toLowerCase(),
      openingBalanceMicros: 0n,
      balanceMicros: 0n,
      lastSettledAt: cutoverAt,
    };
    const events: string[] = [];
    let nowCalls = 0;
    const transaction = {
      mineralAccount: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockImplementation(async () => {
          events.push('account-lock');
          return account;
        }),
        update: vi.fn().mockImplementation(async ({ data }: { data: Partial<typeof account> }) => {
          Object.assign(account, data);
          return account;
        }),
      },
      backendPlanet: {
        findUnique: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([oldPlanet]),
        create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
          id: 'new-planet',
          chainId: 8453,
          ticketId: { toFixed: () => '1' },
          ownerAddress: data.ownerAddress,
          planetName: data.planetName,
          seed: data.seed,
          traitsHash: data.traitsHash,
          generatorVersion: data.generatorVersion,
          planetType: data.planetType,
          terrain: data.terrain,
          rarity: data.rarity,
          satelliteCount: data.satelliteCount,
          hasRing: data.hasRing,
          baseMineralsPerDay: data.baseMineralsPerDay,
          generatedAt: data.generatedAt,
          status: data.status,
          gifData: data.gifData,
          gifHash: data.gifHash,
          ticketPurchase: persistedTicket,
        })),
      },
      planetUpgradePurchase: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const prisma = {
      ticketPurchase: { findUnique: vi.fn().mockResolvedValue(persistedTicket) },
      backendPlanet: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      $transaction: vi.fn(async (callback: (value: typeof transaction) => unknown) => callback(transaction)),
    } as unknown as PrismaClient;
    const store = new PrismaBackendPlanetStore(
      prisma,
      () => {
        nowCalls += 1;
        events.push(`now-${nowCalls}`);
        return nowCalls === 1 ? draftAt : effectiveAt;
      },
      cutoverAt,
    );

    const generated = await store.generatePlanet(proof);

    expect(generated.generatedAt).toBe(effectiveAt.toISOString());
    expect(account.balanceMicros).toBe(1_000_000n);
    expect(account.lastSettledAt).toBe(effectiveAt);
    expect(events).toEqual(['now-1', 'account-lock', 'now-2']);
    expect(transaction.mineralAccount.update).toHaveBeenCalledOnce();
    expect(transaction.backendPlanet.create).toHaveBeenCalledOnce();
  });
});
