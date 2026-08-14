import { getAddress, stringToHex } from 'viem';
import { BASE_CHAIN_ID, MEGASTERA_SOURCE } from './config.js';
import { MAINNET_JACKPOT, normalizeMegasteraProof, type MegasteraProof } from './eligibility.js';
import type { PrismaClient } from './generated/prisma/client.js';

type PersistedTicket = {
  id?: string;
  chainId: number;
  jackpotAddress: string;
  ticketId: { toFixed: (digits?: number) => string } | string;
  drawingId: { toFixed: (digits?: number) => string } | string;
  recipient: string;
  normals: readonly (number | null)[];
  bonusBall: number;
  source: string;
  originTxHash: string;
  blockNumber: bigint;
  blockHash: string;
  logIndex: number;
  purchasedAt: Date;
};

const decimalString = (value: PersistedTicket['ticketId']) =>
  typeof value === 'string' ? value : value.toFixed(0);

function persistenceData(proof: MegasteraProof) {
  const normalized = normalizeMegasteraProof(proof);
  if (!normalized.blockHash || !normalized.purchasedAt) throw new Error('Ticket proof lacks finalized block provenance.');
  const logIndex = Number(normalized.logIndex);
  if (!Number.isSafeInteger(logIndex) || logIndex < 0) throw new Error('Ticket proof log index is invalid.');
  return {
    chainId: BASE_CHAIN_ID,
    jackpotAddress: MAINNET_JACKPOT.toLowerCase(),
    ticketId: normalized.ticketId.toString(),
    drawingId: normalized.drawingId.toString(),
    recipient: getAddress(normalized.recipient).toLowerCase(),
    normals: [...normalized.normals],
    bonusBall: normalized.bonusBall,
    source: stringToHex(MEGASTERA_SOURCE, { size: 32 }),
    originTxHash: normalized.originTxHash.toLowerCase(),
    blockNumber: normalized.blockNumber,
    blockHash: normalized.blockHash.toLowerCase(),
    logIndex,
    purchasedAt: normalized.purchasedAt,
  };
}

function matches(record: PersistedTicket, candidate: ReturnType<typeof persistenceData>) {
  return (
    record.chainId === candidate.chainId &&
    record.jackpotAddress.toLowerCase() === candidate.jackpotAddress &&
    decimalString(record.ticketId) === candidate.ticketId &&
    decimalString(record.drawingId) === candidate.drawingId &&
    record.recipient.toLowerCase() === candidate.recipient &&
    record.normals.length === candidate.normals.length &&
    record.normals.every((normal, index) => normal === candidate.normals[index]) &&
    record.bonusBall === candidate.bonusBall &&
    record.source.toLowerCase() === candidate.source.toLowerCase() &&
    record.originTxHash.toLowerCase() === candidate.originTxHash &&
    record.blockNumber === candidate.blockNumber &&
    record.blockHash.toLowerCase() === candidate.blockHash &&
    record.logIndex === candidate.logIndex &&
    record.purchasedAt.getTime() === candidate.purchasedAt.getTime()
  );
}

/** Persists only the canonical receipt row needed by backend Planet generation. */
export async function saveMegasteraProof(prisma: PrismaClient, proof: MegasteraProof): Promise<void> {
  const candidate = persistenceData(proof);
  await prisma.$transaction(async (transaction) => {
    const [byTicketId, byReceipt] = await Promise.all([
      transaction.ticketPurchase.findUnique({
        where: {
          chainId_jackpotAddress_ticketId: {
            chainId: candidate.chainId,
            jackpotAddress: candidate.jackpotAddress,
            ticketId: candidate.ticketId,
          },
        },
      }),
      transaction.ticketPurchase.findUnique({
        where: {
          chainId_originTxHash_logIndex: {
            chainId: candidate.chainId,
            originTxHash: candidate.originTxHash,
            logIndex: candidate.logIndex,
          },
        },
      }),
    ]);
    const ticketRecord = byTicketId as PersistedTicket | null;
    const receiptRecord = byReceipt as PersistedTicket | null;
    if (ticketRecord && receiptRecord && ticketRecord.id !== receiptRecord.id) {
      throw new Error('Ticket proof conflicts with existing immutable provenance.');
    }
    for (const record of [ticketRecord, receiptRecord]) {
      if (record && !matches(record, candidate)) throw new Error('Ticket proof conflicts with existing immutable provenance.');
    }
    if (!ticketRecord && !receiptRecord) await transaction.ticketPurchase.create({ data: candidate });
  });
}
