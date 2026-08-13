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
});
