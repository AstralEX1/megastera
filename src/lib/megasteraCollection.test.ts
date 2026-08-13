import { describe, expect, it } from 'vitest';
import type { Address, Hex } from 'viem';
import type { Ticket } from './api';
import { mergeMegasteraCollection } from './megasteraCollection';

const owner = '0x0000000000000000000000000000000000000001' as Address;
const siteHash = `0x${'11'.repeat(32)}` as Hex;
const localHash = `0x${'22'.repeat(32)}` as Hex;
const externalHash = `0x${'33'.repeat(32)}` as Hex;

const siteTicket = {
  ticketId: '7',
  drawingId: '12',
  normals: [1, 2, 3, 4, 5],
  bonusBall: 6,
  originTxHash: siteHash,
  logIndex: '4',
};

function apiTicket(txHash: Hex, ticketId: string): Ticket {
  return {
    id: `${txHash}:${ticketId}`,
    wallet: owner,
    buyer: owner,
    round_id: '12',
    user_ticket_id: ticketId,
    normals: [1, 2, 3, 4, 5],
    bonusball: 6,
    matched_normals: null,
    bonusball_match: null,
    winnings_amount: null,
    claimed: false,
    claimed_tx_hash: null,
    tx_hash: txHash,
    block_number: 1,
    created_at: '2026-08-13T12:00:00.000Z',
  };
}

describe('Megastera collection merge', () => {
  it('keeps site rows authoritative, adds local pending receipts, and labels other tickets plainly', () => {
    const result = mergeMegasteraCollection(
      [{ generationStatus: 'generated', ticket: siteTicket, planet: null }],
      [apiTicket(siteHash, '7'), apiTicket(externalHash, '9')],
      [{
        ticketId: 8n,
        drawingId: 12n,
        normals: [1, 2, 3, 4, 5],
        bonusBall: 6,
        originTxHash: localHash,
        logIndex: 5n,
      }],
    );

    expect(result.map((item) => item.kind)).toEqual(['site', 'site', 'ticket-only']);
    expect(result[1]?.kind === 'site' && result[1].site.generationStatus).toBe('pending');
    expect(result[2]?.kind === 'ticket-only' && result[2].apiTicket.user_ticket_id).toBe('9');
  });
});
