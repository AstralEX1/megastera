import { describe, expect, it } from 'vitest';
import { calculateUpgradeCostMicros, MINERAL_UPGRADE_CONFIG } from './mineralUpgrades.js';

describe('mineral upgrade pricing', () => {
  it('keeps the cumulative targets and progressive payback prices exact', () => {
    expect(MINERAL_UPGRADE_CONFIG).toEqual([
      { targetLevel: 1, bonusBpsAfter: 1_000, targetPaybackHours: 48 },
      { targetLevel: 2, bonusBpsAfter: 2_500, targetPaybackHours: 60 },
      { targetLevel: 3, bonusBpsAfter: 5_000, targetPaybackHours: 72 },
    ]);
    expect(calculateUpgradeCostMicros({ baseMineralsPerDay: 100n, upgradeBonusBps: 0, targetLevel: 1 })).toBe(20_000_000n);
    expect(calculateUpgradeCostMicros({ baseMineralsPerDay: 100n, upgradeBonusBps: 1_000, targetLevel: 2 })).toBe(37_500_000n);
    expect(calculateUpgradeCostMicros({ baseMineralsPerDay: 100n, upgradeBonusBps: 2_500, targetLevel: 3 })).toBe(75_000_000n);
  });

  it('prices from the actual stored bonus instead of assuming a standard previous level', () => {
    expect(
      calculateUpgradeCostMicros({ baseMineralsPerDay: 37n, upgradeBonusBps: 275, targetLevel: 2 }),
    ).toBe(20_581_250n);
  });

  it('rejects a non-positive incremental bonus', () => {
    expect(() => calculateUpgradeCostMicros({ baseMineralsPerDay: 100n, upgradeBonusBps: 2_500, targetLevel: 2 })).toThrow(
      'Upgrade bonus delta must be positive',
    );
  });
});
