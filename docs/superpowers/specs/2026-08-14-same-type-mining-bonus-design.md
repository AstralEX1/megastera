# Same-Type Mining Bonus

## Objective

Add one derived collection mechanic: owning multiple ready Backend Planets with the
same `planetType` increases the mining rate of every Planet in that same type group.


## Product rules

The bonus is calculated per wallet and per exact `planetType` value. Only `READY`
Backend Planet rows owned by the wallet participate in the count.

| Same-type count | Bonus |
| ---: | ---: |
| 0–2 | 0% |
| 3–4 | 5% |
| 5–9 | 7.5% |
| 10+ | 10% |

The tiers are mutually exclusive; only the highest tier for the current count applies.
The selected tier applies to every Planet in that type group, not only the Planet that
crossed the threshold.

The bonus becomes active when the Planet that crosses a threshold is generated. Mining
before that activation timestamp is not recalculated retroactively. For deterministic
ordering, same-type rows are ordered by `generatedAt ASC, id ASC`; the third, fifth,
and tenth rows in that order activate the corresponding tiers. A Planet generated after
a threshold receives the already-active tier from its own `generatedAt`.

## Architecture

The existing lazy mining model remains the source of truth. A shared, DOM-free mining
calculation layer will:

1. group ready Planets by normalized owner and exact type;
2. derive threshold activation timestamps and the current bonus basis points;
3. calculate effective daily production with fixed-point integer arithmetic; and
4. calculate earned minerals piecewise across bonus activation intervals.

The existing `MINERAL_SCALE` fixed-point convention remains unchanged. Bonus rates use
basis points (`500`, `750`, and `1000`), so a daily effective rate is calculated as:

```text
baseMineralsPerDay × MINERAL_SCALE × (10_000 + bonusBps) / 10_000
```

The same calculation is used by:

- individual Planet mining snapshots;
- wallet mining snapshots and their aggregate totals; and
- live and finalized leaderboard calculations.

No database migration is required. `BackendPlanet.planetType`, `generatedAt`,
`ownerAddress`, and `status` already contain the required inputs.

## API contract

Mining snapshots gain additive fields for each Planet:

- `planetType` — exact stored type;
- `sameTypeCount` — ready Planets of this type in the wallet;
- `collectionBonusBps` — active tier in basis points; and
- existing `effectiveMineralsPerDayMicros` and `earnedMicros` — recalculated with the
  collection modifier.

Existing fields remain unchanged. `baseMineralsPerDay` continues to expose the
unmodified generator rate.

## Frontend behavior

`PlanetMiningOverlay` remains the only new collection-bonus surface. Its metrics become:

```text
base rate | mined | type bonus
```

The third metric shows the active bonus (`+0%`, `+5%`, `+7.5%`, or `+10%`) and the
current progress count, such as `5 SAME TYPE`. This is shown for both the regular and
compact overlay variants. No new collection system, upgrade panel, or mineral-spending
UI is introduced.

## Testing

Tests must cover:

- exact threshold boundaries at 2/3/4/5/9/10;
- mixed Planet types and wallet isolation;
- the bonus applying to every Planet in a type group;
- threshold activation without retroactive production;
- same-timestamp deterministic ordering;
- exact fixed-point handling of the 7.5% tier;
- individual and wallet mining API snapshots;
- live leaderboard consistency; and
- regular and compact Overlay rendering, including the zero-bonus state.

The repository verification gate remains:

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm db:generate
pnpm db:validate
pnpm --filter @megaplanets/planet-generator golden
```

## Out of scope

- Planet ownership transfers or new authentication;
- new database tables or migrations; and
- changes to Megapot purchase, receipt verification, ticket provenance, or Planet
  generation.
