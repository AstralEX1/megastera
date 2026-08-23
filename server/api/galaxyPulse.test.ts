import type { Address, Hex } from 'viem';
import { describe, expect, it } from 'vitest';
import {
  aggregateGalaxyPulseByType,
  deriveGalaxyPulseSeed,
  deriveGalaxyPulseV1,
  GALAXY_PULSE_ALGORITHM_VERSION,
  type GalaxyPulseSlot,
  resolveGalaxyPulseBps,
} from './galaxyPulse.js';

const INPUT = {
  drawingId: 218n,
  seed: `0x${'11'.repeat(32)}` as Hex,
  chainId: 8453,
  jackpotAddress: '0x1111111111111111111111111111111111111111' as Address,
} as const;

describe('Galaxy Pulse V1', () => {
  it('derives a stable seed from the drawing and winning numbers', () => {
    expect(deriveGalaxyPulseSeed({ drawingId: 151n, winningNumbers: 0x1234n })).toBe(
      '0x947b7cc15a9029cfc6aa39072ad5b89bb0dbdbd5fc60872e887bd5c9dfeaffc9',
    );
  });

  it('keeps a literal deterministic vector', () => {
    expect(GALAXY_PULSE_ALGORITHM_VERSION).toBe('MEGASTERA_GALAXY_PULSE_V1');
    expect(deriveGalaxyPulseV1(INPUT)).toEqual([
      { planetType: 'gaia', modifierBps: 1_400 },
      { planetType: 'desert', modifierBps: 834 },
      { planetType: 'oceanic', modifierBps: 4_673 },
      { planetType: 'volcanic', modifierBps: -2_454 },
    ] satisfies readonly GalaxyPulseSlot[]);
  });

  it('derives four signed integer slots inside the BPS range', () => {
    const slots = deriveGalaxyPulseV1(INPUT);

    expect(slots).toHaveLength(4);
    for (const slot of slots) {
      expect(Number.isInteger(slot.modifierBps)).toBe(true);
      expect(slot.modifierBps).toBeGreaterThanOrEqual(-5_000);
      expect(slot.modifierBps).toBeLessThanOrEqual(5_000);
    }
  });

  it('is deterministic for identical inputs', () => {
    expect(deriveGalaxyPulseV1(INPUT)).toEqual(deriveGalaxyPulseV1(INPUT));
    expect(deriveGalaxyPulseV1({ ...INPUT, drawingId: 219n })).not.toEqual(
      deriveGalaxyPulseV1(INPUT),
    );
  });

  it('sums repeated types and resolves stored type casing', () => {
    const slots: readonly GalaxyPulseSlot[] = [
      { planetType: 'nebula', modifierBps: 1_250 },
      { planetType: 'gaia', modifierBps: -500 },
      { planetType: 'nebula', modifierBps: -250 },
      { planetType: 'nebula', modifierBps: 1_000 },
    ];
    const byType = aggregateGalaxyPulseByType(slots);

    expect(byType).toEqual(
      new Map([
        ['nebula', 2_000],
        ['gaia', -500],
      ]),
    );
    expect(resolveGalaxyPulseBps(byType, 'NEBULA')).toBe(2_000);
    expect(resolveGalaxyPulseBps(byType, 'GaIa')).toBe(-500);
    expect(resolveGalaxyPulseBps(byType, 'unknown')).toBe(0);
  });
});
