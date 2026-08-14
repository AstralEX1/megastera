# My Planets UI Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make My Planets concise and readable by adding a four-metric collection summary, simplifying Planet cards and the detail panel, preventing overflow, and showing settled Megapot winning numbers.

**Architecture:** Keep the current page and card architecture. Derive collection counts from the merged inventory, use the existing wallet mining aggregate fields for rate and mined totals, reuse the typed `useRound` Data API hook for historical winning numbers, and keep Megapot settlement/read invariants intact.

**Tech Stack:** React, TypeScript, Tailwind utility classes, TanStack Query, wagmi/viem, Megapot Data API, Vitest, pnpm.

## Global Constraints

- Use English source identifiers and tests; preserve existing Russian collaboration language.
- Use the existing `api.round` / `useRound` Data API surface for `Round.winning_numbers`.
- Do not treat a round as settled until the API supplies settled round data and winning numbers; do not change purchase, claim, or receipt behavior.
- Preserve the metadata `Base rate` value from `planet.baseMineralsPerDay`.
- Remove the Planet image-overlay ticket ID and avoid exposing long unbounded text in compact card surfaces.
- Do not commit changes.

### Task 1: Collection summary

**Files:**
- Modify: `src/pages/Planets.tsx`
- Test: `src/pages/Planets.test.tsx`

**Interfaces:**
- Consume `collection.length`, `generatedRows.length`, `mining.data.effectiveMineralsPerDayMicros`, and `mining.data.earnedMicros`.
- Produce four short labels rendered above their values: `Planets`, `Tickets`, `Mining Rate`, and `Mined`.

- [x] Write a failing test asserting the summary uses the requested label/value order and removes the old prose/count duplication.
- [x] Run `pnpm exec vitest run src/pages/Planets.test.tsx` and confirm the new assertions fail.
- [x] Render the summary as a responsive four-column desktop / two-by-two mobile grid using the existing HUD/data typography and mineral accent only for mining values.
- [x] Keep total tickets equal to the merged collection count and show pending state only on pending cards, not as another competing headline metric.
- [x] Run the focused page test and confirm it passes.

### Task 2: Planet cards and overflow cleanup

**Files:**
- Modify: `src/pages/Planets.tsx`
- Modify: `src/components/planets/PlanetMiningOverlay.tsx`
- Test: `src/pages/Planets.test.tsx`
- Test: `src/components/planets/PlanetMiningOverlay.test.tsx`

**Interfaces:**
- Keep `PlanetMiningOverlay`'s existing mining snapshot contract.
- Keep `PlanetTicketAction` as the status/claim source, but position it in the card's lower-right action area.

- [x] Write failing assertions for the absence of overlay ticket IDs, `VIEW`, drawing/base-rate duplicates, and visible rarity text.
- [x] Run the focused card/overlay tests and confirm they fail.
- [x] Remove the image-overlay ticket ID, `VIEW`, drawing row, duplicate card base rate, and visible rarity copy.
- [x] Move the ticket action into a bottom-right anchored card action region while preserving claim behavior and status text.
- [x] Add `min-w-0`, `truncate`, `whitespace-nowrap`, and `shrink-0` boundaries to type, names, mining values, and action areas where appropriate.
- [x] Make all mining icons use the white visual treatment while retaining accessible labels.
- [x] Run the focused tests and confirm they pass.

### Task 3: Detail panel and rarity framing

**Files:**
- Modify: `src/pages/Planets.tsx`
- Test: `src/pages/Planets.test.tsx`

**Interfaces:**
- Consume `planet.rarity`, `planet.gifUrl`, and the existing selected-planet detail state.
- Produce a detail image frame whose border/glow matches the Planet rarity; remove `SELECTED PLANET`, the ticket number heading, and `MINING ACTIVE`.

- [x] Write failing assertions for the removed detail labels and rarity frame class.
- [x] Run the page test and confirm it fails.
- [x] Add rarity-aware image-frame classes with Common kept restrained and higher rarities receiving distinct glow shadows.
- [x] Remove redundant detail labels while keeping ticket coordinates, details, claim action, and receipt provenance.
- [x] Run the focused page test and confirm it passes.

### Task 4: Settled winning numbers

**Files:**
- Modify: `src/hooks/useRound.ts`
- Modify: `src/pages/Planets.tsx`
- Test: `src/pages/Planets.test.tsx`

**Interfaces:**
- Consume `useRound(planet.ticket.drawingId)` and `Round.winning_numbers` from `src/lib/api.ts`.
- Produce a `Winning numbers` section only when the round is settled and the API returns normal numbers plus a bonus ball.

- [x] Write a failing detail-panel test with a settled `Round` fixture and assert the five normal balls plus bonus ball render.
- [x] Run the focused page test and confirm it fails.
- [x] Reuse the existing lottery `Ball` component and API query cache; keep unsettled/absent winning numbers hidden.
- [x] If the selected drawing has no winning data yet, keep the panel stable without inventing numbers or showing a false settled state.
- [x] Run the focused page test and confirm it passes.

### Task 5: Verification

**Files:**
- No additional production files.

- [x] Run `pnpm lint`.
- [x] Run `pnpm typecheck`.
- [x] Run `pnpm test`.
- [x] Run `pnpm build`.
- [x] Run `pnpm db:generate` and `pnpm db:validate`.
- [x] Run `pnpm --filter @megaplanets/planet-generator golden`.
- [x] Run `git diff --check`, inspect status, and verify no commit was created.
