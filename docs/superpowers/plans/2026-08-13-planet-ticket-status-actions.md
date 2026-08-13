# Planet Ticket Status Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the Megapot ticket status and single-ticket claim affordance from a standalone navigation tab onto each backend Planet card and its detail panel.

**Architecture:** A `BackendPlanet` remains a database record whose immutable `ticketId` and `drawingId` identify the Megapot ticket. The existing RPC/Data API status derivation remains the source of truth; the Planet UI renders a compact status/action control beside the card and in the detail panel. Claim continues through the existing simulated `Jackpot.claimWinnings(uint256[])` hook, with no Planet NFT, reveal, voucher, holdings, or indexer code.

**Tech Stack:** React, TypeScript, wagmi, TanStack Query, viem, Tailwind, Vitest, Testing Library, pnpm.

## Global Constraints

- Work only in `C:\Users\alexe\Documents\ChatGPT\Megastera`; never modify `MegaPlanets 2`.
- Use `pnpm`; do not add dependencies or commit secrets.
- Keep Base Sepolia and the existing Megapot ABI/configuration.
- Preserve `BackendPlanet` database ownership and mining behavior.
- Do not add NFT mint/reveal/voucher/Pinata/holdings/indexer paths.
- Keep the existing claim simulation, receipt handling, batch limit, and query invalidation.
- Do not nest an interactive claim button inside the card selection button.

---

### Task 1: Lock the new card-level interaction contract with failing tests

**Files:**
- Modify: `src/pages/Planets.test.tsx`
- Create or modify: `src/components/planets/PlanetTicketAction.test.tsx`
- Modify: `src/components/layout/Nav.test.tsx`

**Interfaces:**
- `PlanetTicketAction` consumes a `BackendPlanet` ticket reference, the derived `TicketStatus`, and a single-ticket claim callback/state.
- The Planet page continues to expose selection through a card-level button while the status control is an independent interactive element.

- [ ] **Step 1: Write the failing tests**

  Add tests that assert:

  ```tsx
  expect(screen.queryByRole('button', { name: 'Ticket status' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Claim .*USDC/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Astraea/i })).toBeInTheDocument();
  ```

  Assert that clicking the claim action calls the claim callback with the selected Planet's `ticketId`, while clicking the card still selects the Planet. Assert that the claim control is not a descendant of the card selection button.

- [ ] **Step 2: Run the focused tests and verify RED**

  Run:

  ```bash
  pnpm vitest run src/pages/Planets.test.tsx src/components/planets/PlanetTicketAction.test.tsx src/components/layout/Nav.test.tsx
  ```

  Expected result: the new card-level action assertions fail because the current UI only exposes status on `/tickets` and the standalone Nav item still exists.

### Task 2: Remove the standalone Ticket status navigation affordance

**Files:**
- Modify: `src/components/layout/Nav.tsx`
- Modify: `src/components/layout/Nav.test.tsx`
- Verify: `src/lib/appRoute.ts`, `src/App.tsx`, `src/pages/Tickets.tsx`

**Interfaces:**
- `NavKey` may keep `tickets` for internal navigation compatibility, but `ITEMS` must not render a `Ticket status` item.
- `/tickets` may remain a directly reachable compatibility page while no longer being a primary navigation tab.

- [ ] **Step 1: Remove the `tickets` item from `ITEMS` and update the Nav test**

  Keep Play, My planets, and Leaderboard in the primary navigation. Remove only the rendered `Ticket status` item; do not delete the existing claim hook or Data API code in this task.

- [ ] **Step 2: Run the Nav and route tests**

  ```bash
  pnpm vitest run src/components/layout/Nav.test.tsx src/lib/appRoute.test.ts
  ```

  Expected result: PASS with no primary-nav button named `Ticket status`; existing direct `/tickets` parsing remains covered if retained.

### Task 3: Add a reusable Planet ticket status/action control

**Files:**
- Create: `src/components/planets/PlanetTicketAction.tsx`
- Test: `src/components/planets/PlanetTicketAction.test.tsx`
- Modify: `src/lib/ticketStatus.ts` only if the existing status vocabulary needs an explicit `claimable` mapping.

**Interfaces:**
- Props:

  ```ts
  type PlanetTicketActionProps = {
    status: TicketStatus;
    onClaim?: () => void;
    isClaimPending?: boolean;
    claimError?: Error | null;
  };
  ```

- The control renders `Drawing in HH:MM:SS`, `Drawing…`, `Claim $X`, `Claimed $X`, `Drawn`, or an unavailable state.
- Claim is disabled while waiting for signature/mining and reports the existing transaction error without changing Planet data.

- [ ] **Step 1: Implement the smallest status-to-control mapping after RED**

  Reuse `TicketStatusBadge` styling where possible, but make the claimable state a real button with a visible target of at least 44px on touch layouts and a clear keyboard focus ring.

- [ ] **Step 2: Run the component test**

  ```bash
  pnpm vitest run src/components/planets/PlanetTicketAction.test.tsx
  ```

  Expected result: PASS for all status variants and claim callback behavior.

### Task 4: Wire status and single-ticket claim into My Planets

**Files:**
- Modify: `src/pages/Planets.tsx`
- Modify: `src/pages/Planets.test.tsx`
- Modify: `src/hooks/useClaimWinnings.ts` only if a single-ID call needs no semantic change; do not change the contract ABI.

**Interfaces:**
- Read `useJackpotState()` and the wallet's Data API ticket rows with a one-minute stale/refetch policy already used by the ticket hooks.
- Map each `BackendPlanet.ticket.ticketId` and `BackendPlanet.ticket.drawingId` through `deriveTicketStatus`.
- Call `useClaimWinnings().claim([BigInt(planet.ticketId)])` for a claimable Planet.

- [ ] **Step 1: Build status maps without a continuous indexer**

  Match Data API ticket rows by `user_ticket_id`. Use the current drawing RPC phase/countdown for active tickets and Data API `matched_normals`, `winnings_amount`, and `claimed` for settled tickets.

- [ ] **Step 2: Make card and detail actions siblings, not nested controls**

  Keep the card selection handler on the visual/card container or a non-overlapping selection button. Render `PlanetTicketAction` as a sibling in the card footer and as a separate control in the detail panel.

- [ ] **Step 3: Add pending/error/refetch behavior**

  Disable only the relevant Planet claim action while the existing claim hook is pending. After a successful receipt, invalidate/refetch wallet ticket and win queries through the existing hook behavior; do not write a Planet or mining row.

- [ ] **Step 4: Run focused Planet tests**

  ```bash
  pnpm vitest run src/pages/Planets.test.tsx src/components/planets/PlanetTicketAction.test.tsx src/hooks/useClaimWinnings.test.tsx
  ```

  Expected result: PASS, including correct ticket ID forwarding and independent card selection.

### Task 5: Browser and full repository verification

**Files:**
- Verify only; update `docs/STATUS.md` or `docs/HANDOFF_2026-08-13-megastera-backend-mvp.md` only if the current checkpoint wording still claims a standalone Ticket status tab.

- [ ] **Step 1: Run the repository gate**

  ```bash
  pnpm lint
  pnpm typecheck
  pnpm test
  pnpm build
  pnpm db:generate
  pnpm db:validate
  pnpm --filter @megaplanets/planet-generator golden
  ```

- [ ] **Step 2: Verify browser behavior without a live transaction**

  Check desktop and mobile `/my-planets`:

  - no `Ticket status` item in primary navigation;
  - each Planet card shows exactly one status/action control;
  - clicking the card opens/selects detail;
  - clicking `Claim` does not select the card and passes the Planet's ticket ID to the existing hook;
  - no nested interactive controls and no new NFT/indexer requests.

- [ ] **Step 3: Review the diff and leave unrelated user changes untouched**

  ```bash
  git diff --check
  git status --short
  ```

  Do not stage, commit, or push unrelated pre-existing changes.
