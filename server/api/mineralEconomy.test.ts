import { describe, expect, it } from 'vitest';
import {
  calculateCollectionProduction,
  calculateConstantRateSegment,
  calculateProductionSegments,
  collectionBonusBpsAt,
  type MineralCollectionPlanet,
} from './mineralEconomy.js';

const ANCHOR = new Date('2026-08-10T00:00:00.000Z');

describe('Minerals Economy v2 temporal calculations', () => {
  it('requires one explicit anchor for every settlement calculation', () => {
    expect(() =>
      calculateProductionSegments({
        rateMicrosPerDay: 1n,
        segments: [{ from: ANCHOR, to: new Date('2026-08-11T00:00:00.000Z') }],
      } as unknown as Parameters<typeof calculateProductionSegments>[0]),
    ).toThrow('Production anchor is required');

    const planet: MineralCollectionPlanet = {
      id: 'anchored',
      ownerAddress: '0xabc',
      planetType: 'Gaia',
      baseMineralsPerDay: 1n,
      activatedAt: ANCHOR,
    };
    expect(() =>
      calculateCollectionProduction({
        planet,
        planets: [planet],
        from: ANCHOR,
        to: new Date('2026-08-11T00:00:00.000Z'),
      } as unknown as Parameters<typeof calculateCollectionProduction>[0]),
    ).toThrow('Production anchor is required');
  });

  it('uses one anchored floor so splitting a constant segment is exact', () => {
    const from = new Date('2026-08-10T00:00:00.001Z');
    const split = new Date('2026-08-10T12:00:00.001Z');
    const to = new Date('2026-08-11T00:00:00.001Z');
    const whole = calculateConstantRateSegment({
      rateMicrosPerDay: 101n,
      from,
      to,
      anchor: ANCHOR,
    });
    const parts = calculateProductionSegments({
      rateMicrosPerDay: 101n,
      anchor: ANCHOR,
      segments: [
        { from, to: split },
        { from: split, to },
      ],
    });

    expect(parts).toBe(whole);
  });

  it('keeps split collection settlement exact with a fixed anchor and a remainder', () => {
    const anchor = new Date('2026-08-01T00:00:00.000Z');
    const from = new Date('2026-08-01T00:00:00.001Z');
    const split = new Date('2026-08-01T12:34:56.789Z');
    const to = new Date('2026-08-02T00:00:00.001Z');
    const planet: MineralCollectionPlanet = {
      id: 'split',
      ownerAddress: '0xabc',
      planetType: 'Gaia',
      baseMineralsPerDay: 1n,
      activatedAt: anchor,
    };
    const input = { planet, planets: [planet], anchor };
    const whole = calculateCollectionProduction({ ...input, from, to });
    const first = calculateCollectionProduction({ ...input, from, to: split });
    const second = calculateCollectionProduction({ ...input, from: split, to });

    expect(whole).toBe(1_000_000n);
    expect(first + second).toBe(whole);
  });

  it('keeps an event at the end of a half-open interval out of that interval', () => {
    const upgradeAt = new Date('2026-08-10T12:00:00.000Z');
    expect(
      calculateProductionSegments({
        anchor: ANCHOR,
        segments: [
          { from: ANCHOR, to: upgradeAt, rateMicrosPerDay: 100n },
          { from: upgradeAt, to: new Date('2026-08-11T00:00:00.000Z'), rateMicrosPerDay: 200n },
        ],
      }),
    ).toBe(150n);
  });

  it('activates collection bonuses at the historical third activation', () => {
    const planets: MineralCollectionPlanet[] = [
      {
        id: 'one',
        ownerAddress: '0xabc',
        planetType: 'Gaia',
        baseMineralsPerDay: 100n,
        activatedAt: new Date('2026-08-01T00:00:00.000Z'),
      },
      {
        id: 'two',
        ownerAddress: '0xabc',
        planetType: 'Gaia',
        baseMineralsPerDay: 100n,
        activatedAt: new Date('2026-08-02T00:00:00.000Z'),
      },
      {
        id: 'three',
        ownerAddress: '0xabc',
        planetType: 'Gaia',
        baseMineralsPerDay: 100n,
        activatedAt: new Date('2026-08-03T00:00:00.000Z'),
      },
    ];

    expect(collectionBonusBpsAt(planets, new Date('2026-08-02T23:59:59.999Z'))).toBe(0);
    expect(collectionBonusBpsAt(planets, new Date('2026-08-03T00:00:00.000Z'))).toBe(500);
    expect(
      calculateCollectionProduction({
        planet: planets[0],
        planets,
        from: new Date('2026-08-01T00:00:00.000Z'),
        to: new Date('2026-08-03T00:00:00.000Z'),
        anchor: new Date('2026-08-01T00:00:00.000Z'),
      }),
    ).toBe(200_000_000n);
    expect(
      calculateCollectionProduction({
        planet: planets[0],
        planets,
        from: new Date('2026-08-01T00:00:00.000Z'),
        to: new Date('2026-08-04T00:00:00.000Z'),
        anchor: new Date('2026-08-01T00:00:00.000Z'),
      }),
    ).toBe(305_000_000n);
  });

  it('rejects negative rates and reversed intervals', () => {
    expect(() =>
      calculateConstantRateSegment({
        rateMicrosPerDay: -1n,
        from: ANCHOR,
        to: new Date('2026-08-11T00:00:00.000Z'),
        anchor: ANCHOR,
      }),
    ).toThrow('rateMicrosPerDay cannot be negative');
    expect(() =>
      calculateConstantRateSegment({
        rateMicrosPerDay: 1n,
        from: new Date('2026-08-11T00:00:00.000Z'),
        to: ANCHOR,
        anchor: ANCHOR,
      }),
    ).toThrow('Production interval cannot end before it starts');
  });
});
