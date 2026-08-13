import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from './generated/prisma/client';
import { PrismaBackendPlanetStore } from './backendPlanet';
import type { MegasteraProof } from './eligibility';

const proof = {
  recipient: '0x1111111111111111111111111111111111111111',
  ticketId: 1n,
  drawingId: 1n,
  normals: [1, 2, 3, 4, 5],
  bonusBall: 6,
  originTxHash: `0x${'11'.repeat(32)}`,
  blockNumber: 44_996_800n,
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
      chainId: 84532,
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
});
