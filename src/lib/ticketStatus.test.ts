import { describe, expect, it } from 'vitest';
import { deriveTicketStatus } from './ticketStatus';

const ticket = {
  ticketId: '42',
  drawingId: '7',
  currentDrawingId: 7n,
  drawingTime: 1_700_000_060n,
  nowMs: 1_700_000_000_000,
};

describe('deriveTicketStatus', () => {
  it('shows a live countdown for an open current drawing', () => {
    expect(deriveTicketStatus({ ...ticket, phase: 'open' })).toEqual({
      kind: 'countdown',
      time: '00:01:00',
    });
  });

  it('shows drawing while the current round is awaiting or settling', () => {
    expect(deriveTicketStatus({ ...ticket, phase: 'awaiting' })).toEqual({ kind: 'drawing' });
    expect(deriveTicketStatus({ ...ticket, phase: 'settling' })).toEqual({ kind: 'drawing' });
  });

  it('does not expose unavailable while the live drawing state is still loading', () => {
    expect(deriveTicketStatus({ ...ticket, currentDrawingId: undefined, phase: 'open', drawingStateLoading: true })).toEqual({ kind: 'checking' });
  });

  it('maps settled Data API rows to claimable, claimed, or drawn', () => {
    const settled = {
      matched_normals: 2,
      winnings_amount: { amount: '1250000', decimals: 6 },
      claimed: false,
    };
    expect(deriveTicketStatus({ ...ticket, apiTicket: settled })).toEqual({
      kind: 'claimable',
      amount: 1250000n,
      ticketId: 42n,
    });
    expect(
      deriveTicketStatus({ ...ticket, apiTicket: { ...settled, claimed: true } }),
    ).toEqual({ kind: 'claimed', amount: 1250000n });
    expect(
      deriveTicketStatus({
        ...ticket,
        apiTicket: {
          matched_normals: 1,
          winnings_amount: { amount: '0', decimals: 6 },
          claimed: false,
        },
      }),
    ).toEqual({ kind: 'drawn' });
  });
});
