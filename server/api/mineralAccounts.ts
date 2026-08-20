import { type CollectionMiningPlanet, calculateCollectionMining } from './collectionMining.js';
import type { PrismaClient } from './generated/prisma/client.js';

export type MineralAccountPlanet = CollectionMiningPlanet;

type MineralAccountPlanetRow = {
  id: string;
  ownerAddress: string;
  planetType: string;
  baseMineralsPerDay: bigint;
  generatedAt: Date;
};

function assertCutover(cutoverAt: Date): void {
  if (!Number.isFinite(cutoverAt.getTime()))
    throw new Error('Mineral economy cutover timestamp is invalid.');
}

/**
 * Uses the existing V1 collection calculator unchanged for the cutover snapshot.
 * This is intentionally separate from v2 temporal settlement math.
 */
export function calculateV1WalletOpeningBalance(
  planets: readonly MineralAccountPlanet[],
  cutoverAt: Date,
): bigint {
  assertCutover(cutoverAt);
  const results = calculateCollectionMining({ planets, asOf: cutoverAt });
  let total = 0n;
  for (const result of results.values()) total += result.earnedMicros;
  return total;
}

export type MineralAccountInitializationResult = {
  candidateCount: number;
  createdCount: number;
};

/** Creates missing accounts from one bounded Planet read; existing rows are never updated. */
export async function initializeMineralAccounts(
  prisma: PrismaClient,
  cutoverAt: Date | null | undefined,
): Promise<MineralAccountInitializationResult> {
  if (!cutoverAt) return { candidateCount: 0, createdCount: 0 };
  assertCutover(cutoverAt);
  const planets = (await prisma.backendPlanet.findMany({
    where: { status: 'READY', generatedAt: { lte: cutoverAt } },
    select: {
      id: true,
      ownerAddress: true,
      planetType: true,
      baseMineralsPerDay: true,
      generatedAt: true,
    },
  })) as MineralAccountPlanetRow[];
  const byOwner = new Map<string, MineralAccountPlanet[]>();
  for (const planet of planets) {
    const ownerAddress = planet.ownerAddress.toLowerCase();
    const ownerPlanets = byOwner.get(ownerAddress) ?? [];
    ownerPlanets.push({ ...planet, ownerAddress });
    byOwner.set(ownerAddress, ownerPlanets);
  }

  const data = [...byOwner.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([ownerAddress, ownerPlanets]) => {
      const openingBalanceMicros = calculateV1WalletOpeningBalance(ownerPlanets, cutoverAt);
      return {
        ownerAddress,
        openingBalanceMicros,
        balanceMicros: openingBalanceMicros,
        lastSettledAt: cutoverAt,
      };
    });
  if (data.length === 0) return { candidateCount: 0, createdCount: 0 };
  const created = await prisma.mineralAccount.createMany({ data, skipDuplicates: true });
  return { candidateCount: data.length, createdCount: created.count };
}

export const backfillMineralAccounts = initializeMineralAccounts;
