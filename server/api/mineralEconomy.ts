import {
  calculateEffectiveMineralsPerDayMicros,
  collectionBonusBpsForCount,
} from './collectionMining.js';

export const MILLISECONDS_PER_DAY = 86_400_000n;

export type MineralProductionSegment = {
  from: Date;
  to: Date;
  rateMicrosPerDay?: bigint;
};

export type MineralCollectionPlanet = {
  id: string;
  ownerAddress: string;
  planetType: string;
  baseMineralsPerDay: bigint;
  activatedAt?: Date;
  generatedAt?: Date;
};

export type MineralUpgradePurchase = {
  planetId: string;
  targetLevel: number;
  bonusBpsAfter: number;
  purchasedAt: Date;
};

function activationAt(planet: MineralCollectionPlanet): Date {
  const value = planet.activatedAt ?? planet.generatedAt;
  if (!value) throw new Error(`Planet ${planet.id} activation timestamp is missing.`);
  return value;
}

function timestamp(value: Date, name: string): number {
  const milliseconds = value.getTime();
  if (!Number.isFinite(milliseconds)) throw new Error(`${name} timestamp is invalid.`);
  return milliseconds;
}

function assertNonNegative(name: string, value: bigint): void {
  if (value < 0n) throw new Error(`${name} cannot be negative.`);
}

/**
 * Calculates one constant-rate interval with a shared integer floor anchor.
 * The anchor must be at or before the interval start so split intervals remain exact.
 */
export function calculateConstantRateSegment(input: {
  rateMicrosPerDay: bigint;
  from: Date;
  to: Date;
  anchor: Date;
}): bigint {
  assertNonNegative('rateMicrosPerDay', input.rateMicrosPerDay);
  const from = timestamp(input.from, 'Production start');
  const to = timestamp(input.to, 'Production end');
  if (to < from) throw new Error('Production interval cannot end before it starts.');
  if (!input.anchor) throw new Error('Production anchor is required.');
  const anchor = timestamp(input.anchor, 'Production anchor');
  if (anchor > from) throw new Error('Production anchor cannot be after the interval start.');
  return (
    (input.rateMicrosPerDay * BigInt(to - anchor)) / MILLISECONDS_PER_DAY -
    (input.rateMicrosPerDay * BigInt(from - anchor)) / MILLISECONDS_PER_DAY
  );
}

/** Sums disjoint or adjacent segments against one anchor without per-segment truncation. */
export function calculateProductionSegments(input: {
  rateMicrosPerDay?: bigint;
  segments: readonly MineralProductionSegment[];
  anchor: Date;
}): bigint {
  if (!input.anchor) throw new Error('Production anchor is required.');
  const anchor = input.anchor;
  let total = 0n;
  for (const segment of input.segments) {
    const rateMicrosPerDay = segment.rateMicrosPerDay ?? input.rateMicrosPerDay;
    if (rateMicrosPerDay === undefined) {
      throw new Error('A rateMicrosPerDay is required for every production segment.');
    }
    total += calculateConstantRateSegment({
      rateMicrosPerDay,
      from: segment.from,
      to: segment.to,
      anchor,
    });
  }
  return total;
}

function compareActivations(left: MineralCollectionPlanet, right: MineralCollectionPlanet): number {
  return (
    activationAt(left).getTime() - activationAt(right).getTime() || left.id.localeCompare(right.id)
  );
}

function matchingPlanets(
  planet: MineralCollectionPlanet,
  planets: readonly MineralCollectionPlanet[],
): MineralCollectionPlanet[] {
  const ownerAddress = planet.ownerAddress.toLowerCase();
  return planets
    .filter(
      (candidate) =>
        candidate.ownerAddress.toLowerCase() === ownerAddress &&
        candidate.planetType === planet.planetType,
    )
    .sort(compareActivations);
}

/** Returns the collection tier active at an instant, including events at that instant. */
export function collectionBonusBpsAt(
  planets: readonly MineralCollectionPlanet[],
  at: Date,
  target?: Pick<MineralCollectionPlanet, 'ownerAddress' | 'planetType'>,
): number {
  const atMilliseconds = timestamp(at, 'Collection lookup');
  const selected = target ?? planets[0];
  if (!selected) return 0;
  const matching = planets.filter((planet) => {
    const activatedAt = activationAt(planet);
    timestamp(activatedAt, `Planet ${planet.id} activation`);
    return (
      planet.ownerAddress.toLowerCase() === selected.ownerAddress.toLowerCase() &&
      planet.planetType === selected.planetType &&
      activatedAt.getTime() <= atMilliseconds
    );
  });
  return collectionBonusBpsForCount(matching.length);
}

/**
 * Calculates one Planet's historical collection production over [from, to).
 * Milestone activations at `to` are intentionally applied only to the next interval.
 */
export function calculateCollectionProduction(input: {
  planet: MineralCollectionPlanet;
  planets: readonly MineralCollectionPlanet[];
  from: Date;
  to: Date;
  anchor: Date;
}): bigint {
  const fromMilliseconds = timestamp(input.from, 'Production start');
  const toMilliseconds = timestamp(input.to, 'Production end');
  if (toMilliseconds < fromMilliseconds) {
    throw new Error('Production interval cannot end before it starts.');
  }
  const activatedAt = timestamp(activationAt(input.planet), `Planet ${input.planet.id} activation`);
  if (!input.anchor) throw new Error('Production anchor is required.');
  const startMilliseconds = Math.max(fromMilliseconds, activatedAt);
  if (startMilliseconds >= toMilliseconds) return 0n;
  const anchor = input.anchor;
  const group = matchingPlanets(input.planet, input.planets);
  let cursor = new Date(startMilliseconds);
  let activeCount = 0;
  for (const candidate of group) {
    const candidateActivation = activationAt(candidate);
    const candidateTime = candidateActivation.getTime();
    if (candidateTime > startMilliseconds) break;
    activeCount += 1;
  }
  let activeBonusBps = collectionBonusBpsForCount(activeCount);

  let total = 0n;
  for (const candidate of group) {
    const candidateActivation = activationAt(candidate);
    const candidateTime = candidateActivation.getTime();
    if (candidateTime <= startMilliseconds || candidateTime >= toMilliseconds) continue;
    total += calculateConstantRateSegment({
      rateMicrosPerDay: calculateEffectiveMineralsPerDayMicros(
        input.planet.baseMineralsPerDay,
        activeBonusBps,
      ),
      from: cursor,
      to: candidateActivation,
      anchor,
    });
    cursor = candidateActivation;
    activeCount += 1;
    activeBonusBps = collectionBonusBpsForCount(activeCount);
  }
  total += calculateConstantRateSegment({
    rateMicrosPerDay: calculateEffectiveMineralsPerDayMicros(
      input.planet.baseMineralsPerDay,
      activeBonusBps,
    ),
    from: cursor,
    to: input.to,
    anchor,
  });
  return total;
}

export function upgradeBonusBpsAt(
  purchases: readonly MineralUpgradePurchase[],
  planetId: string,
  atMilliseconds: number,
): number {
  let bonusBps = 0;
  let latestPurchaseAt = Number.NEGATIVE_INFINITY;
  let latestTargetLevel = -1;
  for (const purchase of purchases) {
    const purchaseTime = purchase.purchasedAt.getTime();
    if (purchase.planetId !== planetId || purchaseTime > atMilliseconds) continue;
    if (!Number.isInteger(purchase.bonusBpsAfter) || purchase.bonusBpsAfter < 0) {
      throw new Error('Upgrade purchase bonus must be a non-negative integer.');
    }
    const targetLevel = purchase.targetLevel;
    if (
      purchaseTime > latestPurchaseAt ||
      (purchaseTime === latestPurchaseAt && targetLevel > latestTargetLevel)
    ) {
      latestPurchaseAt = purchaseTime;
      latestTargetLevel = targetLevel;
      bonusBps = purchase.bonusBpsAfter;
    }
  }
  return bonusBps;
}

/** Calculates historical production with collection and upgrade events over [from, to). */
export function calculateHistoricalPlanetProduction(input: {
  planet: MineralCollectionPlanet;
  planets: readonly MineralCollectionPlanet[];
  purchases: readonly MineralUpgradePurchase[];
  from: Date;
  to: Date;
  anchor: Date;
}): bigint {
  const fromMilliseconds = timestamp(input.from, 'Production start');
  const toMilliseconds = timestamp(input.to, 'Production end');
  if (toMilliseconds < fromMilliseconds) {
    throw new Error('Production interval cannot end before it starts.');
  }
  if (!input.anchor) throw new Error('Production anchor is required.');
  const activatedAt = timestamp(activationAt(input.planet), `Planet ${input.planet.id} activation`);
  const startMilliseconds = Math.max(fromMilliseconds, activatedAt);
  if (startMilliseconds >= toMilliseconds) return 0n;

  const group = matchingPlanets(input.planet, input.planets);
  const eventTimes = new Set<number>();
  for (const candidate of group) {
    const candidateTime = activationAt(candidate).getTime();
    if (candidateTime > startMilliseconds && candidateTime < toMilliseconds) eventTimes.add(candidateTime);
  }
  for (const purchase of input.purchases) {
    const purchaseTime = timestamp(purchase.purchasedAt, 'Upgrade purchase');
    if (purchase.planetId === input.planet.id && purchaseTime > startMilliseconds && purchaseTime < toMilliseconds) {
      eventTimes.add(purchaseTime);
    }
  }

  const orderedEvents = [...eventTimes].sort((left, right) => left - right);
  let cursor = new Date(startMilliseconds);
  let activeCount = group.filter((candidate) => activationAt(candidate).getTime() <= startMilliseconds).length;
  let activeBonusBps = collectionBonusBpsForCount(activeCount);
  let activeUpgradeBonusBps = upgradeBonusBpsAt(input.purchases, input.planet.id, startMilliseconds);
  let total = 0n;

  for (const eventTime of orderedEvents) {
    total += calculateConstantRateSegment({
      rateMicrosPerDay: calculateEffectiveMineralsPerDayMicros(
        input.planet.baseMineralsPerDay,
        activeBonusBps + activeUpgradeBonusBps,
      ),
      from: cursor,
      to: new Date(eventTime),
      anchor: input.anchor,
    });
    const eventActivations = group.filter((candidate) => activationAt(candidate).getTime() === eventTime).length;
    activeCount += eventActivations;
    activeBonusBps = collectionBonusBpsForCount(activeCount);
    activeUpgradeBonusBps = upgradeBonusBpsAt(input.purchases, input.planet.id, eventTime);
    cursor = new Date(eventTime);
  }

  total += calculateConstantRateSegment({
    rateMicrosPerDay: calculateEffectiveMineralsPerDayMicros(
      input.planet.baseMineralsPerDay,
      activeBonusBps + activeUpgradeBonusBps,
    ),
    from: cursor,
    to: input.to,
    anchor: input.anchor,
  });
  return total;
}

/** Sums historical production for one owner's bounded Planet batch. */
export function calculateHistoricalProduction(input: {
  planets: readonly MineralCollectionPlanet[];
  purchases: readonly MineralUpgradePurchase[];
  from: Date;
  to: Date;
  anchor: Date;
}): bigint {
  let total = 0n;
  for (const planet of input.planets) {
    total += calculateHistoricalPlanetProduction({ ...input, planet });
  }
  return total;
}
