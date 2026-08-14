# Same-Type Mining Bonus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with review checkpoints. Do not commit the implementation changes unless the user explicitly asks for a commit.

**Goal:** Add a deterministic, lazy same-type collection bonus to Backend Planet mining, wallet totals, leaderboard scores, and the Planet mining Overlay.

**Architecture:** Keep `BackendPlanet` as the source of truth and add a pure, DOM-free collection-mining calculator that groups ready rows by normalized owner and exact `planetType`. The calculator returns current collection metadata, fixed-point effective rates, and piecewise earned minerals so threshold bonuses begin at the generated timestamp of the Planet crossing each tier without retroactive production. Mining stores and leaderboard calculations will consume this one helper; the frontend will render additive snapshot fields in the existing Overlay.

**Tech Stack:** TypeScript, Prisma-generated client types, Vitest, React, Testing Library, pnpm, bigint fixed-point arithmetic with `MINERAL_SCALE`.

## Global Constraints

- Keep the active MVP backend-only; do not add mineral balances, spending, upgrades, auth, workers, or on-chain writes.
- Keep Base Sepolia, Megapot purchase, receipt verification, ticket provenance, and Planet generation behavior unchanged.
- Count only `READY` Backend Planets owned by the wallet; group by exact stored `planetType` after owner-address normalization.
- Use mutually exclusive tiers: 0–2 = 0%, 3–4 = 5%, 5–9 = 7.5%, 10+ = 10%.
- Apply the active tier to every Planet in the same type group.
- Activate a tier at the `generatedAt` timestamp of the third, fifth, or tenth row ordered by `generatedAt ASC, id ASC`; do not recalculate minerals earned before activation.
- Keep bigint values as bigint until serialization and use basis points (`0`, `500`, `750`, `1000`) for bonus rates.
- Use pnpm only and leave all implementation changes uncommitted.
- Preserve the pre-existing untracked `.playwright-mcp` snapshot and do not stage it.

---

### Task 1: Build the pure collection-mining calculator

**Files:**
- Create: `api/collectionMining.ts`
- Test: `api/collectionMining.test.ts`

**Interfaces:**
- Consumes: ready Backend Planet-shaped rows with `id`, `ownerAddress`, `planetType`, `baseMineralsPerDay`, and `generatedAt`, plus an `asOf` timestamp.
- Produces: `COLLECTION_BONUS_BPS`, `CollectionMiningPlanet`, `CollectionMiningResult`, `collectionBonusBpsForCount`, `calculateEffectiveMineralsPerDayMicros`, and `calculateCollectionMining` for mining stores and leaderboard consumers.

- [ ] **Step 1: Write failing threshold tests**

Create `api/collectionMining.test.ts` with a helper that creates deterministic rows for one wallet. Start with the boundary behavior:

```ts
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
```

Add tests that a mixed-type collection counts each type separately and that rows from a second wallet do not affect the first wallet. Assert that every Planet in a group receives the same current `sameTypeCount` and `collectionBonusBps`.

- [ ] **Step 2: Run the focused test and verify the expected RED failure**

Run:

```text
pnpm exec vitest run api/collectionMining.test.ts
```

Expected: the test fails because `api/collectionMining.ts` and its exported calculator functions do not exist yet.

- [ ] **Step 3: Implement the minimal threshold/grouping API**

Define the input and result types and implement the tier function with descending threshold checks. Normalize owner addresses with `toLowerCase()` for grouping. Exclude rows whose `generatedAt` is after `asOf`. Sort each owner/type group by `generatedAt.getTime()` and then `id`.

Use this shape for the per-Planet result:

```ts
export type CollectionMiningResult = {
  planetId: string;
  planetType: string;
  sameTypeCount: number;
  collectionBonusBps: number;
  effectiveMineralsPerDayMicros: bigint;
  earnedMicros: bigint;
};
```

Calculate the current effective rate with:

```ts
baseMineralsPerDay * MINERAL_SCALE * BigInt(10_000 + bonusBps) / 10_000n
```

For this first GREEN slice, keep earned-mineral calculation on the existing base-rate
lifetime formula. The activation-aware interval calculation is introduced only after
the explicit RED tests in Step 5.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run:

```text
pnpm exec vitest run api/collectionMining.test.ts
```

Expected: all threshold, grouping, and result-shape tests pass.

- [ ] **Step 5: Add failing activation and fixed-point tests**

Add tests for a third Planet generated one day after the first two. At `asOf` one day after the third Planet, the first two must contain one pre-bonus day plus one 5% day, while the third contains one 5% day. Add a 5-Planet fixture to verify the 7.5% tier and assert an effective rate of `107_500_000` micros/day for a 100 base-mineral Planet. Add a same-timestamp fixture to verify stable ordering and no NaN/number conversion.

- [ ] **Step 6: Implement activation-aware earned minerals and refactor only while green**

Run the focused test again and confirm the new tests fail because earned minerals are
still calculated at the unmodified base rate. Then split the interval from each
Planet's `generatedAt` through `asOf` at the third, fifth, and tenth group's generated
timestamps, use the rate active in each interval, and sum fixed-point production for
that interval. If multiple threshold rows have the same timestamp, the zero-length
pre-threshold interval produces no retroactive difference; the ordered `id` tie-breaker
still makes the activation event deterministic. Rerun until green and keep the helper
independent of Prisma and browser globals.

---

### Task 2: Apply the calculator to individual and wallet mining snapshots

**Files:**
- Modify: `api/miningStore.ts`
- Test: `api/miningStore.test.ts`

**Interfaces:**
- Consumes: `calculateCollectionMining` and `CollectionMiningPlanet` from Task 1.
- Produces: individual and wallet snapshot objects containing `planetType`, `sameTypeCount`, and `collectionBonusBps`, with effective and earned values returned from the shared calculator.

- [ ] **Step 1: Extend mining-store tests with type groups**

Update the fake Prisma rows to include `ownerAddress`, `planetType`, and stable IDs. Add three same-type rows and one different-type row for the wallet. Assert that the same-type rows all report `sameTypeCount: 3`, `collectionBonusBps: 500`, and a 5% effective rate, while the different type reports zero bonus. Keep the existing lifetime-production assertion for the no-bonus path.

Add an individual snapshot test where the selected Planet is in a three-Planet group and assert the same group metadata and effective rate.

- [ ] **Step 2: Run the focused mining-store tests and verify RED**

Run:

```text
pnpm exec vitest run api/miningStore.test.ts
```

Expected: tests fail because the current Prisma selects omit `planetType`, the wallet snapshot uses the base rate directly, and result objects have no collection fields.

- [ ] **Step 3: Implement shared-calculator reads**

For wallet mining, select `id`, `ownerAddress`, `planetType`, `baseMineralsPerDay`, and `generatedAt` for ready rows, pass them to `calculateCollectionMining`, and map results back in the existing deterministic order. Sum `earnedMicros` and `effectiveMineralsPerDayMicros` from calculated results.

For individual mining, first read the selected ready Planet including `planetType` and `ownerAddress`, then query all ready Planets for that owner and calculate the group in one shared call. Return the selected Planet's result plus its existing `planetId`, `ownerAddress`, `baseMineralsPerDay`, and `activeSince` fields.

Do not change the meaning of `baseMineralsPerDay`; it remains the unmodified generator rate.

- [ ] **Step 4: Run focused tests and then the existing mining tests**

Run:

```text
pnpm exec vitest run api/collectionMining.test.ts api/miningStore.test.ts
```

Expected: both suites pass with the new group metadata and unchanged no-bonus behavior.

---

### Task 3: Apply the same calculation to the leaderboard

**Files:**
- Modify: `api/leaderboardStore.ts`
- Test: `api/leaderboardStore.test.ts`

**Interfaces:**
- Consumes: `calculateCollectionMining` for live Backend Planet rows and the optional `planetType` field for legacy daily inputs.
- Produces: leaderboard `scoreMicros` and `effectiveMineralsPerDayMicros` that match wallet mining for the same rows.

- [ ] **Step 1: Add failing live-leaderboard bonus tests**

Add a live leaderboard fixture with three same-type Planets owned by one wallet and one different-type Planet. Assert that the same-type group contributes three 5%-adjusted rates and scores, while the different-type row remains unmodified. Add a mixed-wallet fixture to verify grouping includes the owner address.

Update existing live fixtures with `id` and `planetType` fields required by the shared calculator. Preserve the current no-bonus assertions for single-Planet wallets.

- [ ] **Step 2: Run leaderboard tests and verify RED**

Run:

```text
pnpm exec vitest run api/leaderboardStore.test.ts
```

Expected: the new assertions fail because live leaderboard code currently sums each base rate without type grouping.

- [ ] **Step 3: Implement live leaderboard integration**

Select `id` and `planetType` in the live Backend Planet query. Filter invalid/zero-address/future rows as before, pass valid rows to `calculateCollectionMining`, and aggregate each result by normalized wallet address. Add `earnedMicros` to `scoreByWallet` and `effectiveMineralsPerDayMicros` to `rateByWallet`.

Keep the existing ranking and cache behavior unchanged.

- [ ] **Step 4: Cover finalized leaderboard inputs**

Pass `id` and `planetType` through the Backend Planet branch used by `finalizeLeaderboardPeriod`. For legacy rows without a type, preserve the existing base-rate calculation with no collection bonus. Add one test to `calculateLeaderboardRows` with typed rows and assert the same threshold multiplier at the period boundary.

- [ ] **Step 5: Run focused leaderboard verification**

Run:

```text
pnpm exec vitest run api/collectionMining.test.ts api/leaderboardStore.test.ts
```

Expected: live, finalized, ranking, and cache tests pass.

---

### Task 4: Extend the frontend snapshot contract and render the Overlay bonus

**Files:**
- Modify: `src/hooks/useWalletMining.ts`
- Modify: `src/components/planets/PlanetMiningOverlay.tsx`
- Test: `src/components/planets/PlanetMiningOverlay.test.tsx`
- Test: `src/hooks/useWalletMining.test.ts`

**Interfaces:**
- Consumes: additive wallet-mining fields `planetType`, `sameTypeCount`, and `collectionBonusBps`.
- Produces: regular and compact Overlays with a third `TYPE BONUS` metric to the right of `MINED`.

- [ ] **Step 1: Add failing frontend contract and rendering assertions**

Extend the mining fixture with:

```ts
planetType: 'Nebula',
sameTypeCount: 3,
collectionBonusBps: 500,
```

Assert the Overlay renders `+5%` and `3 SAME TYPE`, and add a zero-bonus fixture that renders `+0%` and `2 SAME TYPE`. Keep the unavailable and compact-variant assertions. Add a fetch fixture assertion that the hook preserves the new fields from the backend payload.

- [ ] **Step 2: Run focused frontend tests and verify RED**

Run:

```text
pnpm exec vitest run src/components/planets/PlanetMiningOverlay.test.tsx src/hooks/useWalletMining.test.ts
```

Expected: the new text assertions fail because the Overlay currently has only base-rate and mined columns and the snapshot type lacks the new fields.

- [ ] **Step 3: Implement the additive contract and Overlay layout**

Add the three fields to `PlanetMiningSnapshot`. Render the existing base-rate and mined metrics unchanged, then add a compact third metric to the right with a `+0%`/`+5%`/`+7.5%`/`+10%` label and a count label such as `3 SAME TYPE`. Use a three-column grid for both variants, keep the compact typography readable, and add an accessible label such as `Same type collection bonus`.

Format basis points locally without floating-point production arithmetic:

```ts
function formatCollectionBonus(bps: number): string {
  return `+${bps / 100}%`;
}
```

The API remains the source of the numeric bonus; the frontend only formats it.

- [ ] **Step 4: Run focused frontend tests and typecheck the changed surface**

Run:

```text
pnpm exec vitest run src/components/planets/PlanetMiningOverlay.test.tsx src/hooks/useWalletMining.test.ts
pnpm typecheck
```

Expected: focused tests pass and TypeScript reports no errors.

---

### Task 5: Verify the complete feature without committing

**Files:**
- Modify: `docs/superpowers/plans/2026-08-14-same-type-mining-bonus.md` only if execution notes need recording; do not stage the user snapshot.

**Interfaces:**
- Consumes: all implementation and test changes from Tasks 1–4.
- Produces: a locally verified, uncommitted implementation ready for user review.

- [ ] **Step 1: Run all focused affected suites together**

Run:

```text
pnpm exec vitest run api/collectionMining.test.ts api/miningStore.test.ts api/leaderboardStore.test.ts src/components/planets/PlanetMiningOverlay.test.tsx src/hooks/useWalletMining.test.ts
```

Expected: all affected tests pass.

- [ ] **Step 2: Run the repository verification gate**

Run each command from the repository root:

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm db:generate
pnpm db:validate
pnpm --filter @megaplanets/planet-generator golden
```

Record local command results separately from any unavailable live RPC, database, browser, deployment, or funded-wallet checks.

- [ ] **Step 3: Inspect the final diff and status without staging or committing**

Run:

```text
git diff --check
git diff --stat
git status --short
```

Confirm the diff contains only the same-type implementation, tests, and the plan if changed. Confirm `.playwright-mcp/page-2026-08-14T06-29-56-925Z.yml` remains untracked and unstaged. Do not run `git add`, `git commit`, `git push`, or create a pull request.
