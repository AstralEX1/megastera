import { MINERAL_SCALE } from './mining.js';
import { MINERAL_UPGRADE_CONFIG } from './mineralUpgrades.js';

const ACHIEVEMENTS = [
  { id: 'galactic-cartographer', metric: 'uniqueTypes', tiers: [3, 5, 10] },
  { id: 'rarity-hunter', metric: 'rarityRank', tiers: [1, 2, 3] },
  { id: 'type-specialist', metric: 'sameTypePlanets', tiers: [3, 5, 10] },
  { id: 'mineral-tycoon', metric: 'lifetimeMinerals', tiers: [500, 2_500, 25_000] },
  { id: 'planetary-architect', metric: 'maxedPlanets', tiers: [1, 5, 10] },
  { id: 'planetary-empire', metric: 'planetCount', tiers: [5, 10, 25] },
] as const;

type AchievementMiningSnapshot = {
  ownedPlanetCount: number;
  planets: readonly {
    planetType: string;
    rarity: string;
    upgradeLevel: number;
    sameTypeCount: number;
    earnedMicros: string;
  }[];
};

export type AchievementProgress = {
  id: (typeof ACHIEVEMENTS)[number]['id'];
  current: number;
  tiers: readonly number[];
};

export function calculateAchievements(snapshot: AchievementMiningSnapshot): AchievementProgress[] {
  const planets = snapshot.planets;
  const maxUpgradeLevel = MINERAL_UPGRADE_CONFIG.length;
  const lifetimeMinerals = Number(
    planets.reduce((total, planet) => total + BigInt(planet.earnedMicros), 0n) / MINERAL_SCALE,
  );
  const metrics: Record<(typeof ACHIEVEMENTS)[number]['metric'], number> = {
    uniqueTypes: new Set(planets.map((planet) => planet.planetType)).size,
    rarityRank: Math.max(
      0,
      ...planets.map((planet) =>
        planet.rarity === 'Legendary'
          ? 3
          : planet.rarity === 'Epic'
            ? 2
            : planet.rarity === 'Uncommon'
              ? 1
              : 0,
      ),
    ),
    sameTypePlanets: Math.max(0, ...planets.map((planet) => planet.sameTypeCount)),
    lifetimeMinerals,
    maxedPlanets: planets.filter((planet) => planet.upgradeLevel >= maxUpgradeLevel).length,
    planetCount: snapshot.ownedPlanetCount,
  };

  // ponytail: derived completion relies on immutable ownership and monotonic upgrades; persist unlocks if that changes.
  return ACHIEVEMENTS.map(({ id, metric, tiers }) => ({
    id,
    current: Math.min(metrics[metric], tiers[tiers.length - 1]),
    tiers,
  }));
}
