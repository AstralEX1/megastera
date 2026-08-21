import { MINERAL_SCALE } from './mining.js';

const BONUS_DENOMINATOR_BPS = 10_000n;

export type MineralUpgradeConfig = {
  targetLevel: 1 | 2 | 3;
  bonusBpsAfter: number;
  targetPaybackHours: number;
};

export const MINERAL_UPGRADE_CONFIG: readonly MineralUpgradeConfig[] = Object.freeze([
  { targetLevel: 1, bonusBpsAfter: 1_000, targetPaybackHours: 48 },
  { targetLevel: 2, bonusBpsAfter: 2_500, targetPaybackHours: 60 },
  { targetLevel: 3, bonusBpsAfter: 5_000, targetPaybackHours: 72 },
]);

export const UPGRADE_CONFIG = MINERAL_UPGRADE_CONFIG;

function assertTargetLevel(targetLevel: number): asserts targetLevel is 1 | 2 | 3 {
  if (!Number.isInteger(targetLevel) || targetLevel < 1 || targetLevel > 3) {
    throw new Error('Upgrade target level must be an integer between 1 and 3.');
  }
}

export function getMineralUpgradeConfig(targetLevel: number): MineralUpgradeConfig {
  assertTargetLevel(targetLevel);
  const config = MINERAL_UPGRADE_CONFIG[targetLevel - 1];
  if (!config) throw new Error(`Upgrade configuration for level ${targetLevel} is missing.`);
  return config;
}

export function calculateUpgradeCostMicros(input: {
  baseMineralsPerDay: bigint;
  upgradeBonusBps: number;
  targetLevel: number;
}): bigint {
  if (input.baseMineralsPerDay < 0n) throw new Error('baseMineralsPerDay cannot be negative.');
  if (!Number.isInteger(input.upgradeBonusBps) || input.upgradeBonusBps < 0) {
    throw new Error('upgradeBonusBps must be a non-negative integer.');
  }
  const config = getMineralUpgradeConfig(input.targetLevel);
  const deltaBps = config.bonusBpsAfter - input.upgradeBonusBps;
  if (deltaBps <= 0) throw new Error('Upgrade bonus delta must be positive.');
  const incrementalRateMicrosPerDay =
    (input.baseMineralsPerDay * MINERAL_SCALE * BigInt(deltaBps)) / BONUS_DENOMINATOR_BPS;
  return (incrementalRateMicrosPerDay * BigInt(config.targetPaybackHours)) / 24n;
}

export function getNextMineralUpgrade(input: {
  baseMineralsPerDay: bigint;
  upgradeLevel: number;
  upgradeBonusBps: number;
}): { targetLevel: number; bonusBpsAfter: number; costMicros: bigint } | null {
  if (input.upgradeLevel >= 3) return null;
  const targetLevel = input.upgradeLevel + 1;
  const config = getMineralUpgradeConfig(targetLevel);
  return {
    targetLevel,
    bonusBpsAfter: config.bonusBpsAfter,
    costMicros: calculateUpgradeCostMicros({ ...input, targetLevel }),
  };
}
