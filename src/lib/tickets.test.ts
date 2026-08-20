import { describe, expect, it } from 'vitest';
import {
  buildDirectTickets,
  getBulkOrderShape,
  isValidTicket,
  randomTicket,
  syncConfiguredTickets,
  totalCost,
} from './tickets';

describe('purchase routing', () => {
  it('computes the bulk static/dynamic split with a ten-static-ticket cap', () => {
    expect(getBulkOrderShape({ count: 11, staticTicketCount: 10 })).toEqual({
      dynamicCount: 1,
      staticTicketCount: 10,
    });
    expect(getBulkOrderShape({ count: 50, staticTicketCount: 0 })).toEqual({
      dynamicCount: 50,
      staticTicketCount: 0,
    });
    expect(() => getBulkOrderShape({ count: 10, staticTicketCount: 1 })).toThrow(/bulk/i);
    expect(() => getBulkOrderShape({ count: 11, staticTicketCount: 11 })).toThrow(/static/i);
  });

  it('keeps total purchase cost as raw USDC bigint', () => {
    expect(totalCost({ ticketPriceUsdcRaw: 1_000_000n, count: 11 })).toBe(11_000_000n);
  });

  it('generates complete client-side direct quick-picks', () => {
    const ticket = randomTicket({ ballMax: 30, bonusballMax: 12 });
    expect(isValidTicket(ticket, { ballMax: 30, bonusballMax: 12 })).toBe(true);
  });

  it('rejects malformed random-pick bounds instead of looping forever', () => {
    expect(() => randomTicket({ ballMax: 4, bonusballMax: 12 })).toThrow(/ballMax/i);
    expect(() => randomTicket({ ballMax: 30, bonusballMax: 0 })).toThrow(/bonusballMax/i);
  });

  it('requires the direct purchase array to already be complete', () => {
    const configured = { normals: [1, 2, 3, 4, 5], bonusball: 6 };
    expect(() =>
      buildDirectTickets({
        customTickets: [configured],
        count: 2,
        bounds: { ballMax: 30, bonusballMax: 12 },
      }),
    ).toThrow(/complete/i);
  });

  it('rejects incomplete direct purchase input before simulating the write', () => {
    expect(() =>
      buildDirectTickets({
        customTickets: [{ normals: [1, 2], bonusball: 3 }],
        count: 1,
        bounds: { ballMax: 30, bonusballMax: 12 },
      }),
    ).toThrow(/custom ticket/i);
  });

  it('fills the configured ticket array before Coordinates opens', () => {
    expect(
      syncConfiguredTickets({
        count: 3,
        tickets: [],
        bounds: { ballMax: 30, bonusballMax: 12 },
        random: () => ({ normals: [1, 2, 3, 4, 5], bonusball: 6 }),
      }),
    ).toHaveLength(3);
  });

  it('preserves the configured prefix when quantity changes', () => {
    const first = { normals: [1, 2, 3, 4, 5], bonusball: 6 };
    const second = { normals: [6, 7, 8, 9, 10], bonusball: 7 };
    const result = syncConfiguredTickets({
      count: 3,
      tickets: [first, second],
      bounds: { ballMax: 30, bonusballMax: 12 },
      random: () => ({ normals: [11, 12, 13, 14, 15], bonusball: 8 }),
    });

    expect(result).toEqual([first, second, { normals: [11, 12, 13, 14, 15], bonusball: 8 }]);
    expect(
      syncConfiguredTickets({
        count: 1,
        tickets: result,
        bounds: { ballMax: 30, bonusballMax: 12 },
      }),
    ).toEqual([first]);
  });

  it('replaces only tickets invalidated by new drawing bounds', () => {
    const valid = { normals: [1, 2, 3, 4, 5], bonusball: 6 };
    const invalid = { normals: [6, 7, 8, 9, 10], bonusball: 12 };
    const replacement = { normals: [11, 12, 13, 14, 15], bonusball: 7 };

    expect(
      syncConfiguredTickets({
        count: 2,
        tickets: [valid, invalid],
        bounds: { ballMax: 15, bonusballMax: 10 },
        random: () => replacement,
      }),
    ).toEqual([valid, replacement]);
  });
});
