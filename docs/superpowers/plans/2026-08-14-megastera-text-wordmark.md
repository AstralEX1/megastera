# Text-only Megastera Wordmark Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the visible Megastera graphic marks with one uppercase `MEGASTERA` text wordmark on Landing, `/play`, and the Landing footer.

**Architecture:** Keep the current page structure and animation behavior. Add one `COPY.brandName` source string for the shared shell and Landing page, remove the shared SVG mark and Landing `M` elements, and leave all navigation, checkout, and planet behavior unchanged.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Vite, Biome, pnpm.

## Global Constraints

- Work only on the text-only wordmark scope from `docs/superpowers/specs/2026-08-14-megastera-text-wordmark-design.md`.
- The visible brand string must be exactly `MEGASTERA` in uppercase.
- Preserve routing, navigation, wallet controls, purchase flow, page layout, and existing Landing motion.
- Use `COPY.brandName` as the single source for the visible application brand name.
- Remove active `BrandMark` imports/usages and the unused `BrandMark.tsx` module.
- Do not modify any unrelated working-tree changes already present in the repository.
- Use pnpm and do not introduce another package manager.

---

### Task 1: Add failing wordmark assertions

**Files:**
- Modify: `src/pages/Landing.test.tsx`
- Modify: `src/components/layout/Layout.test.tsx`

**Interfaces:**
- Consumes: the existing `Landing` and `Layout` render fixtures.
- Produces: focused regression coverage requiring two Landing text wordmarks and one uppercase shell wordmark with no SVG logo.

- [ ] **Step 1: Add the Landing regression test**

Add this test inside `describe('Landing', ...)`:

```tsx
it('uses the same text-only wordmark in the header and footer', () => {
  const { container } = render(<Landing />);
  const wordmarks = [...container.querySelectorAll('.landing-wordmark-name')];

  expect(wordmarks).toHaveLength(2);
  expect(wordmarks.every((wordmark) => wordmark.textContent === 'MEGASTERA')).toBe(true);
  expect(container.querySelectorAll('.landing-wordmark-mark')).toHaveLength(0);
});
```

- [ ] **Step 2: Add the shared-shell regression test**

Add this test inside `describe('Layout', ...)`:

```tsx
it('renders an uppercase text-only brand in the shell', () => {
  render(<Layout active="play" onSelect={vi.fn()}><p>Page content</p></Layout>);

  const brandLink = screen.getByRole('link', { name: 'MEGASTERA' });
  expect(brandLink).toHaveTextContent('MEGASTERA');
  expect(brandLink.querySelector('svg')).not.toBeInTheDocument();
});
```

- [ ] **Step 3: Run the focused tests and confirm the new assertions fail**

Run:

```text
pnpm exec vitest run src/pages/Landing.test.tsx src/components/layout/Layout.test.tsx
```

Expected: the new assertions fail because the current implementation renders `Megastera` plus the graphic `M`/`BrandMark`.

### Task 2: Implement the text-only wordmark

**Files:**
- Modify: `src/config/copy.ts`
- Modify: `src/components/layout/Layout.tsx`
- Modify: `src/components/layout/Layout.test.tsx`
- Modify: `src/pages/Landing.tsx`
- Modify: `src/pages/Landing.css`
- Delete: `src/components/layout/BrandMark.tsx`

**Interfaces:**
- Consumes: `COPY.brandName` from `src/config/copy.ts`.
- Produces: text-only `MEGASTERA` markup in the shared shell, Landing header, and Landing footer.

- [ ] **Step 1: Replace split shell copy with the shared brand value**

In `src/config/copy.ts`, replace the `brandShort` and `brandSuffix` entries with:

```ts
/** Visible text-only brand used by the application shell and Landing page. */
brandName: 'MEGASTERA',
```

- [ ] **Step 2: Remove the shell SVG and render one text node**

In `src/components/layout/Layout.tsx`:

1. Remove `import { BrandMark } from './BrandMark';`.
2. Remove the `BrandMark` customization comment that describes the logo swap point.
3. Replace the brand link contents with:

```tsx
<span>{COPY.brandName}</span>
```

4. Keep the existing link, header spacing, typography, and navigation unchanged.

- [ ] **Step 3: Remove the Landing graphic marks and share the same text**

In `src/pages/Landing.tsx`:

1. Import `COPY` from `@/config/copy`.
2. In both `.landing-wordmark` links, remove:

```tsx
<span className="landing-wordmark-mark" aria-hidden="true">M</span>
```

3. Replace `LandingSplitText text="Megastera"` with:

```tsx
<LandingSplitText text={COPY.brandName} className="landing-wordmark-name" />
```

- [ ] **Step 4: Remove mark-only CSS and the dead component**

In `src/pages/Landing.css`, delete only the `.landing-wordmark-mark` rule. Delete `src/components/layout/BrandMark.tsx` after the import is gone. Do not alter the remaining wordmark typography or responsive rules.

- [ ] **Step 5: Clean the Layout test fixture**

In `src/components/layout/Layout.test.tsx`, remove the obsolete module mock:

```tsx
vi.mock('./BrandMark', () => ({ BrandMark: () => <span>Logo</span> }));
```

- [ ] **Step 6: Run focused tests and confirm they pass**

Run:

```text
pnpm exec vitest run src/pages/Landing.test.tsx src/components/layout/Layout.test.tsx
```

Expected: all tests in both files pass, including the new text-only wordmark assertions.

- [ ] **Step 7: Confirm no active logo references remain**

Run:

```text
rg -n "BrandMark|landing-wordmark-mark|brandShort|brandSuffix" src
```

Expected: no matches.

- [ ] **Step 8: Commit only the wordmark implementation files**

Stage the implementation files explicitly, excluding all pre-existing user changes:

```text
git add src/config/copy.ts src/components/layout/Layout.tsx src/components/layout/Layout.test.tsx src/pages/Landing.tsx src/pages/Landing.css src/pages/Landing.test.tsx src/components/layout/BrandMark.tsx
git commit -m "refactor: use text-only megastera wordmark"
```

### Task 3: Run the repository verification gate

**Files:**
- Read-only verification of the implementation and existing repository.

**Interfaces:**
- Consumes: the committed text-only wordmark implementation.
- Produces: local evidence for lint, types, tests, build, database checks, generator golden tests, and optional browser inspection.

- [ ] **Step 1: Run the required repository commands**

Run from the repository root:

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm db:generate
pnpm db:validate
pnpm --filter @megaplanets/planet-generator golden
```

Expected: each command exits successfully. Report any blocked database, RPC, deployment, or browser check separately from local command results.

- [ ] **Step 2: Re-check the final diff boundary**

Run:

```text
git status --short
git diff HEAD^ -- src/config/copy.ts src/components/layout/Layout.tsx src/components/layout/Layout.test.tsx src/pages/Landing.tsx src/pages/Landing.css src/pages/Landing.test.tsx
```

Expected: the diff contains only the approved text-only wordmark changes; unrelated `Planets` and other pre-existing worktree changes remain outside the commit.

- [ ] **Step 3: Inspect Landing and `/play` visually when a local browser is available**

Verify the Landing header, Landing footer, and `/play` shell show only the uppercase `MEGASTERA` text and no graphic `M`. Treat this as browser evidence separate from unit/build success.
