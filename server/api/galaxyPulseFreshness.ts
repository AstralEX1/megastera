import type { PrismaClient } from './generated/prisma/client.js';

const ACTIVE_ROUND_URL = 'https://api.megapot.io/v1/rounds/active';
const LATEST_SETTLED_ROUND_URL = 'https://api.megapot.io/v1/rounds/latest-settled';
const STALE_ERROR = 'Galaxy Pulse is not fresh; retry later.';

export function isGalaxyPulseFreshnessError(error: unknown): boolean {
  return error instanceof Error && error.message === STALE_ERROR;
}

type RoundSummary = {
  id: string;
  status: 'active' | 'settled';
  ended_at?: string | null;
  settled_at?: string | null;
};

async function readRound(fetchImpl: typeof fetch, url: string): Promise<RoundSummary> {
  const response = await fetchImpl(url, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(STALE_ERROR);
  const value = (await response.json()) as Partial<RoundSummary>;
  if (typeof value.id !== 'string' || !/^\d+$/.test(value.id)) throw new Error(STALE_ERROR);
  if (value.status !== 'active' && value.status !== 'settled') throw new Error(STALE_ERROR);
  return value as RoundSummary;
}

export async function assertGalaxyPulseFresh(input: {
  prisma: PrismaClient;
  galaxyPulseStartBlock: bigint | null;
  now: Date;
  fetchImpl?: typeof fetch;
}): Promise<void> {
  if (input.galaxyPulseStartBlock === null) return;
  try {
    const fetchImpl = input.fetchImpl ?? fetch;
    const [active, settled, latestPulse] = await Promise.all([
      readRound(fetchImpl, ACTIVE_ROUND_URL),
      readRound(fetchImpl, LATEST_SETTLED_ROUND_URL),
      input.prisma.galaxyPulseRound.findFirst({
        orderBy: { drawingId: 'desc' },
        select: { drawingId: true },
      }),
    ]);
    const endedAt = active.ended_at ? new Date(active.ended_at) : null;
    const settledAt = settled.settled_at ? new Date(settled.settled_at) : null;
    const activeId = BigInt(active.id);
    const settledId = BigInt(settled.id);
    if (
      active.status !== 'active' ||
      settled.status !== 'settled' ||
      !endedAt ||
      !Number.isFinite(endedAt.getTime()) ||
      !settledAt ||
      !Number.isFinite(settledAt.getTime()) ||
      input.now >= endedAt ||
      activeId !== settledId + 1n ||
      !latestPulse ||
      BigInt(latestPulse.drawingId.toString()) !== settledId
    )
      throw new Error(STALE_ERROR);
  } catch {
    throw new Error(STALE_ERROR);
  }
}
