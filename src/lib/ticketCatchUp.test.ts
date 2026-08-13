import { describe, expect, it } from 'vitest';
import type { Address, Hex, TransactionReceipt } from 'viem';
import type { Ticket } from './api';
import type { PurchasedTicket } from './purchaseReceipt';
import {
  collectWalletTicketTransactionHashes,
  collectCanonicalReceiptTickets,
  type WalletTicketPage,
} from './ticketCatchUp';

const account = '0x1111111111111111111111111111111111111111' as Address;
const firstHash = `0x${'11'.repeat(32)}` as Hex;
const secondHash = `0x${'22'.repeat(32)}` as Hex;

function apiTicket(txHash: Hex): Ticket {
  return {
    id: txHash,
    wallet: account,
    buyer: account,
    round_id: '12',
    user_ticket_id: '456',
    normals: [1, 2, 3, 4, 5],
    bonusball: 6,
    matched_normals: null,
    bonusball_match: null,
    winnings_amount: null,
    claimed: false,
    claimed_tx_hash: null,
    tx_hash: txHash,
    block_number: 100,
    created_at: '2026-08-13T12:00:00.000Z',
  };
}

function purchasedTicket(txHash: Hex, logIndex: bigint): PurchasedTicket {
  return {
    ticketId: 456n + logIndex,
    drawingId: 12n,
    normals: [1, 2, 3, 4, 5],
    bonusBall: 6,
    originTxHash: txHash,
    logIndex,
  };
}

describe('wallet ticket catch-up discovery', () => {
  it('paginates every wallet page and deduplicates transaction hashes', async () => {
    const pages: WalletTicketPage[] = [
      { data: [apiTicket(firstHash), apiTicket(firstHash)], next_cursor: 'next', has_more: true },
      { data: [apiTicket(secondHash)], next_cursor: null, has_more: false },
    ];
    const cursors: (string | undefined)[] = [];

    await expect(
      collectWalletTicketTransactionHashes(account, async (_address, options) => {
        cursors.push(options?.cursor);
        return pages[cursors.length - 1];
      }),
    ).resolves.toEqual([firstHash, secondHash]);
    expect(cursors).toEqual([undefined, 'next']);
  });

  it('merges local canonical tickets with every canonical event recovered from discovered receipts', async () => {
    const local = purchasedTicket(firstHash, 1n);
    const receiptByHash = new Map<Hex, TransactionReceipt>([
      [firstHash, { transactionHash: firstHash } as TransactionReceipt],
      [secondHash, { transactionHash: secondHash } as TransactionReceipt],
    ]);
    const parsed = new Map<Hex, readonly PurchasedTicket[]>([
      [firstHash, [local]],
      [secondHash, [purchasedTicket(secondHash, 2n), purchasedTicket(secondHash, 3n)]],
    ]);

    await expect(
      collectCanonicalReceiptTickets({
        address: account,
        localTickets: [local],
        transactionHashes: [firstHash, secondHash, secondHash],
        getReceipt: async (hash) => {
          const receipt = receiptByHash.get(hash);
          if (!receipt) throw new Error('Receipt fixture is missing.');
          return receipt;
        },
        parseReceipt: (receipt) => parsed.get(receipt.transactionHash) ?? [],
      }),
    ).resolves.toEqual([local, purchasedTicket(secondHash, 2n), purchasedTicket(secondHash, 3n)]);
  });
});
