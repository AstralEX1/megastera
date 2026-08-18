# Coming Soon Roadmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a frontend-only `Coming Soon` roadmap tab that matches Megastera and highlights the next Mid-Season 1 update.

**Architecture:** Extend the existing lightweight History API router with a `comingSoon` navigation key and `/coming-soon` path. Render a standalone roadmap page inside the existing `Layout`, keeping all visuals/data local to the page. Adapt React Bits' pointer spotlight behavior into a small reusable component for the current milestone only.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-18-coming-soon-roadmap-design.md`

## Global Constraints

- Do not change ticket purchase, planet generation, mining, leaderboard data, API, or database behavior.
- Use existing Megastera colors, typography, spacing, and app shell.
- No new runtime dependencies.
- Motion stays restrained: one pointer spotlight interaction only.
- Keep source code and UI copy in English.

---

### Task 1: Route and navigation

**Files:**
- Modify: `src/lib/appRoute.test.ts`
- Modify: `src/lib/appRoute.ts`
- Modify: `src/components/layout/Nav.tsx`

**Interfaces:**
- Produces: `NavKey` value `comingSoon`, route `/coming-soon`.

- [ ] Add failing assertions that `/coming-soon` parses to `{ active: 'comingSoon' }` and `navPath('comingSoon')` returns `/coming-soon`.
- [ ] Implement the new `NavKey`, desktop/mobile nav item, parse route, and canonical path.
- [ ] Verify route tests pass in CI.

### Task 2: Roadmap page

**Files:**
- Create: `src/pages/ComingSoon.test.tsx`
- Create: `src/pages/ComingSoon.tsx`
- Create: `src/components/common/SpotlightCard.tsx`

**Interfaces:**
- Produces: `<ComingSoon />` page and `<SpotlightCard />` interaction component.

- [ ] Add page tests asserting Roadmap heading, all five milestones, active Mid-Season content, Season 2 Legacy disclosure, and Season 3 PvP details.
- [ ] Implement a small spotlight component adapted from React Bits `SpotlightCard`, using Megastera styling and no added dependency.
- [ ] Implement the vertical mission-path roadmap with subdued Genesis, highlighted Mid-Season 1 Update, progressively muted future sections, a static orbital motif for Season 2, and a faint static ship motif for Season 3.
- [ ] Ensure Legacy disclosure works on hover/focus/tap using native accessible controls and content.
- [ ] Verify page tests pass in CI.

### Task 3: App integration and verification

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `ComingSoon`, `NavKey: comingSoon`.

- [ ] Lazy-load the new page and render it for the `comingSoon` route.
- [ ] Open a draft PR to trigger `.github/workflows/verify.yml`.
- [ ] Confirm CI runs `pnpm db:generate`, `pnpm db:validate`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` successfully.
