import { MINERAL_SCALE } from './mining';

const BONUS_DENOMINATOR_BPS = 10_000n;
const MILLISECONDS_PER_DAY = 86_400_000n;
const COLLECTION_BONUS_MILESTONES = [
  { count: 3, bonusBps: 500 },
  { count: 5, bonusBps: 750 },
  { count: 10, bonusBps: 1_000 },
] as const;

export const COLLECTION_BONUS_BPS = Object.freeze({
  none: 0,
  three: 500,
  five: 750,
  ten: 1_000,
} as const);

export type CollectionMiningPlanet = {
  id: string;
  ownerAddress: string;
  planetType: string;
  baseMineralsPerDay: bigint;
  generatedAt: Date;
};

export type CollectionMiningResult = {
  planetId: string;
  planetType: string;
  sameTypeCount: number;
  collectionBonusBps: number;
  effectiveMineralsPerDayMicros: bigint;
  earnedMicros: bigint;
};

export function collectionBonusBpsForCount(count: number): number {
  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError('Same-type Planet count must be a non-negative integer.');
  }
  if (count >= 10) return COLLECTION_BONUS_BPS.ten;
  if (count >= 5) return COLLECTION_BONUS_BPS.five;
  if (count >= 3) return COLLECTION_BONUS_BPS.three;
  return COLLECTION_BONUS_BPS.none;
}

export function calculateEffectiveMineralsPerDayMicros(
  baseMineralsPerDay: bigint,
  collectionBonusBps: number,
): bigint {
  if (baseMineralsPerDay < 0n) throw new Error('baseMineralsPerDay cannot be negative.');
  if (!Number.isInteger(collectionBonusBps) || collectionBonusBps < 0) {
    throw new RangeError('Collection bonus basis points must be a non-negative integer.');
  }
  return (
    baseMineralsPerDay *
    MINERAL_SCALE *
    BigInt(10_000 + collectionBonusBps)
  ) / BONUS_DENOMINATOR_BPS;
}

function collectionGroupKey(planet: CollectionMiningPlanet): string {
  return `${planet.ownerAddress.toLowerCase()}\u0000${planet.planetType}`;
}

function comparePlanets(left: CollectionMiningPlanet, right: CollectionMiningPlanet): number {
  const generatedAtDifference = left.generatedAt.getTime() - right.generatedAt.getTime();
  return generatedAtDifference || left.id.localeCompare(right.id);
}

function calculateMineralsAtRate(
  effectiveMineralsPerDayMicros: bigint,
  startedAt: Date,
  endedAt: Date,
): bigint {
  const elapsed = endedAt.getTime() - startedAt.getTime();
  if (elapsed < 0) throw new Error('Mining timestamp cannot be before Planet generation.');
  return (effectiveMineralsPerDayMicros * BigInt(elapsed)) / MILLISECONDS_PER_DAY;
}

function calculateCollectionEarnedMicros(
  planet: CollectionMiningPlanet,
  orderedGroup: readonly CollectionMiningPlanet[],
  asOf: Date,
): bigint {
  const milestones = COLLECTION_BONUS_MILESTONES
    .filter(({ count }) => count <= orderedGroup.length)
    .flatMap(({ count, bonusBps }) => {
      const generatedAt = orderedGroup[count - 1]?.generatedAt;
      return generatedAt ? [{ generatedAt, bonusBps }] : [];
    });

  let earnedMicros = 0n;
  let cursor = planet.generatedAt;
  let activeBonusBps = 0;
  const startTime = cursor.getTime();
  const endTime = asOf.getTime();

  for (const milestone of milestones) {
    const milestoneTime = milestone.generatedAt.getTime();
    if (milestoneTime <= startTime) {
      activeBonusBps = milestone.bonusBps;
      continue;
    }
    if (milestoneTime >= endTime) break;

    earnedMicros += calculateMineralsAtRate(
      calculateEffectiveMineralsPerDayMicros(planet.baseMineralsPerDay, activeBonusBps),
      cursor,
      milestone.generatedAt,
    );
    cursor = milestone.generatedAt;
    activeBonusBps = milestone.bonusBps;
  }

  earnedMicros += calculateMineralsAtRate(
    calculateEffectiveMineralsPerDayMicros(planet.baseMineralsPerDay, activeBonusBps),
    cursor,
    asOf,
  );
  return earnedMicros;
}

/** Calculates current same-type modifiers for all active Planets without browser state. */
export function calculateCollectionMining(input: {
  planets: readonly CollectionMiningPlanet[];
  asOf: Date;
}): Map<string, CollectionMiningResult> {
  if (!Number.isFinite(input.asOf.getTime())) throw new Error('Mining timestamp is invalid.');

  const groups = new Map<string, CollectionMiningPlanet[]>();
  for (const planet of input.planets) {
    if (!Number.isFinite(planet.generatedAt.getTime())) {
      throw new Error(`Planet ${planet.id} generation timestamp is invalid.`);
    }
    if (planet.generatedAt.getTime() > input.asOf.getTime()) continue;
    const key = collectionGroupKey(planet);
    const group = groups.get(key) ?? [];
    group.push(planet);
    groups.set(key, group);
  }

  const results = new Map<string, CollectionMiningResult>();
  for (const group of groups.values()) {
    const orderedGroup = [...group].sort(comparePlanets);
    const sameTypeCount = orderedGroup.length;
    const collectionBonusBps = collectionBonusBpsForCount(sameTypeCount);
    for (const planet of orderedGroup) {
      results.set(planet.id, {
        planetId: planet.id,
        planetType: planet.planetType,
        sameTypeCount,
        collectionBonusBps,
        effectiveMineralsPerDayMicros: calculateEffectiveMineralsPerDayMicros(
          planet.baseMineralsPerDay,
          collectionBonusBps,
        ),
        earnedMicros: calculateCollectionEarnedMicros(planet, orderedGroup, input.asOf),
      });
    }
  }
  return results;
}
