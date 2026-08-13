import { type Address, type Hex, isHash, type TransactionReceipt } from 'viem';
import { api, type Page, type Ticket } from './api';
import {
  type PurchasedTicket,
  readPurchasedTickets,
} from './purchaseReceipt';

export type WalletTicketPage = Pick<Page<Ticket>, 'data' | 'next_cursor' | 'has_more'>;
export type WalletTicketPageFetcher = (
  address: `0x${string}`,
  options: { limit: number; cursor?: string },
) => Promise<WalletTicketPage>;

const PAGE_SIZE = 100;

/** Reads the wallet-scoped Data API feed without creating a global ticket index. */
export async function collectWalletTicketTransactionHashes(
  address: Address,
  fetchPage: WalletTicketPageFetcher = (wallet, options) => api.walletTickets(wallet, options),
): Promise<readonly Hex[]> {
  const hashes = new Set<string>();
  const seenCursors = new Set<string>();
  let cursor: string | undefined;
  while (true) {
    const page = await fetchPage(address, { limit: PAGE_SIZE, cursor });
    for (const ticket of page.data) {
      if (isHash(ticket.tx_hash)) hashes.add(ticket.tx_hash.toLowerCase());
    }
    if (!page.has_more || !page.next_cursor) break;
    if (seenCursors.has(page.next_cursor)) {
      throw new Error('Megapot wallet ticket pagination repeated a cursor.');
    }
    seenCursors.add(page.next_cursor);
    cursor = page.next_cursor;
  }
  return [...hashes].map((hash) => hash as Hex);
}

function provenanceKey(ticket: PurchasedTicket): string {
  return `${ticket.originTxHash.toLowerCase()}:${ticket.logIndex.toString()}`;
}

export type CanonicalReceiptTicketDeps = {
  address: Address;
  localTickets?: readonly PurchasedTicket[];
  transactionHashes: readonly Hex[];
  getReceipt: (hash: Hex) => Promise<TransactionReceipt>;
  parseReceipt?: (receipt: TransactionReceipt, address: Address) => readonly PurchasedTicket[];
};

/** Replays wallet-discovered receipts and keeps only canonical Megastera events. */
export async function collectCanonicalReceiptTickets({
  address,
  localTickets = [],
  transactionHashes,
  getReceipt,
  parseReceipt = (receipt, expectedRecipient) => readPurchasedTickets(receipt, expectedRecipient),
}: CanonicalReceiptTicketDeps): Promise<readonly PurchasedTicket[]> {
  const tickets = new Map<string, PurchasedTicket>();
  for (const ticket of localTickets) tickets.set(provenanceKey(ticket), ticket);
  const hashes = [...new Set(transactionHashes.map((hash) => hash.toLowerCase()))] as Hex[];
  for (const hash of hashes) {
    try {
      const receipt = await getReceipt(hash);
      for (const ticket of parseReceipt(receipt, address)) tickets.set(provenanceKey(ticket), ticket);
    } catch {
      // A Data API row can arrive before an RPC fallback sees the receipt, or can
      // belong to another source. The next wallet-scoped pass will retry it.
    }
  }
  return [...tickets.values()].sort((left, right) => {
    const leftKey = provenanceKey(left);
    const rightKey = provenanceKey(right);
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
  });
}
