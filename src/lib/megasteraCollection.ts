import type { Ticket } from './api';
import type { BackendPlanetCollectionRow } from './backendApi';
import type { PurchasedTicket } from './purchaseReceipt';

export type MegasteraCollectionItem =
  | { kind: 'site'; key: string; site: BackendPlanetCollectionRow }
  | { kind: 'ticket-only'; key: string; apiTicket: Ticket };

function siteKey(row: BackendPlanetCollectionRow): string {
  return `${row.ticket.originTxHash.toLowerCase()}:${row.ticket.ticketId}`;
}

function apiKey(ticket: Ticket): string {
  return `${ticket.tx_hash.toLowerCase()}:${ticket.user_ticket_id}`;
}

function purchasedKey(ticket: PurchasedTicket): string {
  return `${ticket.originTxHash.toLowerCase()}:${ticket.ticketId.toString()}`;
}

function pendingRow(ticket: PurchasedTicket): BackendPlanetCollectionRow {
  return {
    generationStatus: 'pending',
    ticket: {
      ticketId: ticket.ticketId.toString(),
      drawingId: ticket.drawingId.toString(),
      normals: [...ticket.normals],
      bonusBall: ticket.bonusBall,
      originTxHash: ticket.originTxHash,
      logIndex: ticket.logIndex.toString(),
    },
    planet: null,
    generationError: null,
  };
}

/** Merges the site's durable receipt registry with the wallet-scoped Data API feed. */
export function mergeMegasteraCollection(
  siteRows: readonly BackendPlanetCollectionRow[],
  walletTickets: readonly Ticket[],
  locallyConfirmedTickets: readonly PurchasedTicket[] = [],
): MegasteraCollectionItem[] {
  const rows = [...siteRows];
  const rowKeys = new Set(rows.map(siteKey));
  for (const ticket of locallyConfirmedTickets) {
    const key = purchasedKey(ticket);
    if (rowKeys.has(key)) continue;
    rows.push(pendingRow(ticket));
    rowKeys.add(key);
  }
  const site = rows.map((row) => ({ kind: 'site' as const, key: siteKey(row), site: row }));
  const external = walletTickets
    .filter((ticket) => !rowKeys.has(apiKey(ticket)))
    .map((ticket) => ({ kind: 'ticket-only' as const, key: apiKey(ticket), apiTicket: ticket }));
  return [...site, ...external];
}
