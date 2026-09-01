import { describe, expect, it } from 'vitest';
import { formatMinerals, interpolateMinerals } from './minerals';

describe('formatMinerals', () => {
  it('formats fixed-point mineral micros without converting large values to number', () => {
    expect(formatMinerals(1_000_000n)).toBe('1');
    expect(formatMinerals(12_345_678n)).toBe('12.34');
    expect(formatMinerals(9_007_199_254_740_993_000_000n)).toBe('9,007,199,254,740,993');
  });

  it('rounds to the nearest whole mineral when no fraction digits are requested', () => {
    expect(formatMinerals(12_499_999n, 0)).toBe('12');
    expect(formatMinerals(12_500_000n, 0)).toBe('13');
    expect(formatMinerals(14_798_690_309n, 0)).toBe('14,799');
  });
});

describe('interpolateMinerals', () => {
  it('adds display-only production elapsed since the canonical server snapshot', () => {
    expect(interpolateMinerals({
      snapshotMicros: 5_000_000n,
      effectiveMineralsPerDayMicros: 86_400_000_000n,
      asOf: new Date('2026-08-10T00:00:00.000Z'),
      now: new Date('2026-08-10T00:00:01.000Z'),
    })).toBe(6_000_000n);
  });

  it('never subtracts minerals when the client clock is behind the server', () => {
    expect(interpolateMinerals({
      snapshotMicros: 5_000_000n,
      effectiveMineralsPerDayMicros: 86_400_000_000n,
      asOf: new Date('2026-08-10T00:00:01.000Z'),
      now: new Date('2026-08-10T00:00:00.000Z'),
    })).toBe(5_000_000n);
  });
});
