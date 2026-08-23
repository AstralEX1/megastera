import type { Hex } from 'viem';
import { describe, expect, it, vi } from 'vitest';
import { BASE_CHAIN_ID } from './config.js';
import { BASE_JACKPOT } from './eligibility.js';
import { aggregateGalaxyPulseByType, deriveGalaxyPulseV1 } from './galaxyPulse.js';
import {
  type GalaxyPulseRoundRow,
  type GalaxyPulseStoreClient,
  type GalaxyPulseTemporalRound,
  loadGalaxyPulseRounds,
  serializeCurrentGalaxyPulse,
} from './galaxyPulseStore.js';

const TO = new Date('2026-08-22T00:00:00.000Z');
const SEED_A = `0x${'11'.repeat(32)}` as Hex;
const SEED_B = `0x${'22'.repeat(32)}` as Hex;

function row(
  drawingId: bigint,
  settledAt: string,
  seed: Hex,
): GalaxyPulseRoundRow & { seed: Hex } {
  return { drawingId, seed, settledAt: new Date(settledAt) };
}

function drawingId(round: GalaxyPulseRoundRow): bigint {
  return BigInt(round.drawingId.toString());
}

function expectedModifiers(round: GalaxyPulseRoundRow & { seed: Hex }): Record<string, number> {
  return Object.fromEntries(
    aggregateGalaxyPulseByType(
      deriveGalaxyPulseV1({
        drawingId: drawingId(round),
        seed: round.seed,
        chainId: BASE_CHAIN_ID,
        jackpotAddress: BASE_JACKPOT,
      }),
    ),
  );
}

describe('Galaxy Pulse store', () => {
  it('loads settled rounds through an explicit minimal client in deterministic time order', async () => {
    const later = row(2n, '2026-08-21T00:00:00.000Z', SEED_B);
    const earlier = row(1n, '2026-08-20T00:00:00.000Z', SEED_A);
    const findMany = vi.fn(async () => [later, earlier]);
    const client: GalaxyPulseStoreClient = { galaxyPulseRound: { findMany } };

    await expect(loadGalaxyPulseRounds(client, TO)).resolves.toEqual([
      {
        drawingId: 1n,
        settledAt: earlier.settledAt,
        slots: deriveGalaxyPulseV1({
          drawingId: drawingId(earlier),
          seed: earlier.seed,
          chainId: BASE_CHAIN_ID,
          jackpotAddress: BASE_JACKPOT,
        }),
        modifiersBps: expectedModifiers(earlier),
      },
      {
        drawingId: 2n,
        settledAt: later.settledAt,
        slots: deriveGalaxyPulseV1({
          drawingId: drawingId(later),
          seed: later.seed,
          chainId: BASE_CHAIN_ID,
          jackpotAddress: BASE_JACKPOT,
        }),
        modifiersBps: expectedModifiers(later),
      },
    ]);
    expect(findMany).toHaveBeenCalledWith({
      where: { settledAt: { lte: TO } },
      orderBy: { settledAt: 'asc' },
    });
  });

  it('serializes the current stored round with raw slots and stable strings', () => {
    const stored = row(218n, '2026-08-21T12:34:56.000Z', SEED_A);
    const temporal: GalaxyPulseTemporalRound = {
      drawingId: drawingId(stored),
      settledAt: stored.settledAt,
      slots: deriveGalaxyPulseV1({
        drawingId: drawingId(stored),
        seed: stored.seed,
        chainId: BASE_CHAIN_ID,
        jackpotAddress: BASE_JACKPOT,
      }),
      modifiersBps: expectedModifiers(stored),
    };

    expect(serializeCurrentGalaxyPulse(temporal)).toEqual({
      drawingId: '218',
      settledAt: stored.settledAt.toISOString(),
      slots: temporal.slots,
    });
    expect(serializeCurrentGalaxyPulse(null)).toBeNull();
  });
});
