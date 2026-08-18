import { describe, expect, it } from 'vitest';
import {
  calculateCollectionMining,
  collectionBonusBpsForCount,
  type CollectionMiningPlanet,
} from './collectionMining.js';

const OWNER_A = '0x1111111111111111111111111111111111111111';
const OWNER_B = '0x2222222222222222222222222222222222222222';
const AS_OF = new Date('2026-08-20T00:00:00.000Z');

function planet(
  id: string,
  ownerAddress: string,
  planetType: string,
  generatedAt: string,
  baseMineralsPerDay = 100n,
): CollectionMiningPlanet {
  return {
    id,
    ownerAddress,
    planetType,
    baseMineralsPerDay,
    generatedAt: new Date(generatedAt),
  };
}

describe('collection mining bonus thresholds', () => {
  it.each([
    [2, 0],
    [3, 500],
    [4, 500],
    [5, 750],
    [9, 750],
    [10, 1000],
    [12, 1000],
  ])('maps %s same-type Planets to %s bonus basis points', (count, expectedBps) => {
    expect(collectionBonusBpsForCount(count)).toBe(expectedBps);
  });

  it('groups by wallet and exact Planet type and applies the tier to every Planet in the group', () => {
    const results = calculateCollectionMining({
      asOf: AS_OF,
      planets: [
        planet('nebula-1', OWNER_A, 'Nebula', '2026-08-17T00:00:00.000Z'),
        planet('nebula-2', OWNER_A, 'Nebula', '2026-08-18T00:00:00.000Z'),
        planet('nebula-3', OWNER_A, 'Nebula', '2026-08-19T00:00:00.000Z'),
        planet('gaia-1', OWNER_A, 'Gaia', '2026-08-19T12:00:00.000Z'),
        planet('nebula-other-wallet', OWNER_B, 'Nebula', '2026-08-19T12:00:00.000Z'),
      ],
    });

    expect(results.get('nebula-1')).toMatchObject({
      planetType: 'Nebula',
      sameTypeCount: 3,
      collectionBonusBps: 500,
    });
    expect(results.get('nebula-2')).toMatchObject({ sameTypeCount: 3, collectionBonusBps: 500 });
    expect(results.get('nebula-3')).toMatchObject({ sameTypeCount: 3, collectionBonusBps: 500 });
    expect(results.get('gaia-1')).toMatchObject({ sameTypeCount: 1, collectionBonusBps: 0 });
    expect(results.get('nebula-other-wallet')).toMatchObject({ sameTypeCount: 1, collectionBonusBps: 0 });
  });

  it('starts the three-Planet bonus at the threshold without recalculating earlier production', () => {
    const results = calculateCollectionMining({
      asOf: new Date('2026-08-04T00:00:00.000Z'),
      planets: [
        planet('nebula-1', OWNER_A, 'Nebula', '2026-08-01T00:00:00.000Z'),
        planet('nebula-2', OWNER_A, 'Nebula', '2026-08-02T00:00:00.000Z'),
        planet('nebula-3', OWNER_A, 'Nebula', '2026-08-03T00:00:00.000Z'),
      ],
    });

    expect(results.get('nebula-1')?.earnedMicros).toBe(305_000_000n);
    expect(results.get('nebula-2')?.earnedMicros).toBe(205_000_000n);
    expect(results.get('nebula-3')?.earnedMicros).toBe(105_000_000n);
  });

  it('keeps the five-Planet tier exact at 7.5 percent', () => {
    const results = calculateCollectionMining({
      asOf: new Date('2026-08-06T00:00:00.000Z'),
      planets: Array.from({ length: 5 }, (_, index) =>
        planet(
          `nebula-${index + 1}`,
          OWNER_A,
          'Nebula',
          `2026-08-0${index + 1}T00:00:00.000Z`,
        ),
      ),
    });

    expect(results.get('nebula-1')).toMatchObject({
      sameTypeCount: 5,
      collectionBonusBps: 750,
      effectiveMineralsPerDayMicros: 107_500_000n,
    });
  });

  it('uses stable ids when multiple same-type Planets share a timestamp', () => {
    const results = calculateCollectionMining({
      asOf: new Date('2026-08-02T00:00:00.000Z'),
      planets: [
        planet('nebula-3', OWNER_A, 'Nebula', '2026-08-01T00:00:00.000Z'),
        planet('nebula-1', OWNER_A, 'Nebula', '2026-08-01T00:00:00.000Z'),
        planet('nebula-2', OWNER_A, 'Nebula', '2026-08-01T00:00:00.000Z'),
      ],
    });

    for (const id of ['nebula-1', 'nebula-2', 'nebula-3']) {
      expect(results.get(id)).toMatchObject({
        sameTypeCount: 3,
        collectionBonusBps: 500,
        earnedMicros: 105_000_000n,
      });
    }
  });
});
