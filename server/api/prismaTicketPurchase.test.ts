import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from './generated/prisma/client.js';
import { saveMegasteraProof } from './prismaTicketPurchase.js';
import { BASE_JACKPOT, type MegasteraProof } from './eligibility.js';
import { MEGASTERA_SOURCE } from './config.js';
import { stringToHex } from 'viem';

const proof = {
  chainId: 8453,
  recipient: '0x1111111111111111111111111111111111111111',
  ticketId: 7n,
  drawingId: 2n,
  normals: [1, 2, 3, 4, 5],
  bonusBall: 6,
  originTxHash: `0x${'11'.repeat(32)}`,
  blockNumber: 30_000_000n,
  logIndex: 4n,
  blockHash: `0x${'22'.repeat(32)}`,
  purchasedAt: new Date('2026-08-21T00:00:00.000Z'),
} as unknown as MegasteraProof;

function row() {
  return {
    id: 'ticket-row',
    chainId: 8453,
    jackpotAddress: BASE_JACKPOT.toLowerCase(),
    ticketId: { toFixed: () => '7' },
    drawingId: { toFixed: () => '2' },
    recipient: proof.recipient,
    normals: proof.normals,
    bonusBall: proof.bonusBall,
    source: stringToHex(MEGASTERA_SOURCE, { size: 32 }),
    originTxHash: proof.originTxHash,
    blockNumber: proof.blockNumber,
    blockHash: proof.blockHash,
    logIndex: 4,
    purchasedAt: proof.purchasedAt,
  };
}

describe('saveMegasteraProof cross-instance idempotency', () => {
  it('accepts a concurrent unique conflict when both canonical keys reread the identical proof', async () => {
    const winner = row();
    const findUnique = vi.fn().mockResolvedValue(winner);
    const prisma = {
      ticketPurchase: { findUnique },
      $transaction: vi.fn(async (callback: (client: typeof prisma) => unknown) => {
        const transaction = {
          ticketPurchase: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockRejectedValue({ code: 'P2002' }),
          },
        };
        return callback(transaction as never);
      }),
    } as unknown as PrismaClient;

    await expect(saveMegasteraProof(prisma, proof)).resolves.toBeUndefined();
    expect(findUnique).toHaveBeenCalledTimes(2);
  });

  it('rejects a concurrent unique conflict when either canonical key rereads a mismatch', async () => {
    const winner = { ...row(), ticketId: { toFixed: () => '8' } };
    const findUnique = vi.fn().mockResolvedValueOnce(winner).mockResolvedValueOnce(winner);
    const prisma = {
      ticketPurchase: { findUnique },
      $transaction: vi.fn(async (callback: (client: typeof prisma) => unknown) => {
        const transaction = {
          ticketPurchase: {
            findUnique: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockRejectedValue({ code: 'P2002' }),
          },
        };
        return callback(transaction as never);
      }),
    } as unknown as PrismaClient;

    await expect(saveMegasteraProof(prisma, proof)).rejects.toThrow(
      'Ticket proof conflicts with existing immutable provenance.',
    );
  });
});
