import { isHash } from 'viem';
import { BASE_CHAIN_ID } from './config.js';
import { BASE_JACKPOT } from './eligibility.js';
import {
  aggregateGalaxyPulseByType,
  deriveGalaxyPulseV1,
  type GalaxyPulseSlot,
} from './galaxyPulse.js';

export type GalaxyPulseRoundRow = {
  drawingId: bigint | string | { toString(): string };
  entropy: string;
  settledAt: Date;
};

export type GalaxyPulseStoreClient = {
  galaxyPulseRound: {
    findMany(args: {
      where: { settledAt: { lte: Date } };
      orderBy: { settledAt: 'asc' };
    }): Promise<readonly GalaxyPulseRoundRow[]>;
  };
};

export type GalaxyPulseTemporalRound = {
  drawingId: bigint;
  settledAt: Date;
  slots: readonly GalaxyPulseSlot[];
  modifiersBps: Readonly<Record<string, number>>;
};

export type SerializedGalaxyPulse = {
  drawingId: string;
  settledAt: string;
  slots: readonly GalaxyPulseSlot[];
};

function normalizeDrawingId(row: GalaxyPulseRoundRow): bigint {
  const drawingId = BigInt(row.drawingId.toString());
  if (drawingId < 0n) throw new RangeError('Galaxy Pulse drawing ID cannot be negative.');
  return drawingId;
}

function deriveSlots(row: GalaxyPulseRoundRow): readonly GalaxyPulseSlot[] {
  if (!isHash(row.entropy)) throw new Error('Galaxy Pulse entropy is invalid.');
  return deriveGalaxyPulseV1({
    drawingId: normalizeDrawingId(row),
    entropy: row.entropy,
    chainId: BASE_CHAIN_ID,
    jackpotAddress: BASE_JACKPOT,
  });
}

function temporalRound(row: GalaxyPulseRoundRow): GalaxyPulseTemporalRound {
  const drawingId = normalizeDrawingId(row);
  const slots = deriveSlots(row);
  return {
    drawingId,
    settledAt: row.settledAt,
    slots,
    modifiersBps: Object.fromEntries(aggregateGalaxyPulseByType(slots)),
  };
}

export async function loadGalaxyPulseRounds(
  client: GalaxyPulseStoreClient,
  to: Date,
): Promise<readonly GalaxyPulseTemporalRound[]> {
  const rows = await client.galaxyPulseRound.findMany({
    where: { settledAt: { lte: to } },
    orderBy: { settledAt: 'asc' },
  });
  return rows
    .filter((row) => row.settledAt.getTime() <= to.getTime())
    .map((row) => temporalRound(row))
    .sort(
      (left, right) =>
        left.settledAt.getTime() - right.settledAt.getTime() ||
        (left.drawingId < right.drawingId ? -1 : left.drawingId > right.drawingId ? 1 : 0),
    );
}

export function serializeCurrentGalaxyPulse(
  round: GalaxyPulseTemporalRound | null,
): SerializedGalaxyPulse | null {
  if (!round) return null;
  return {
    drawingId: round.drawingId.toString(),
    settledAt: round.settledAt.toISOString(),
    slots: round.slots,
  };
}
