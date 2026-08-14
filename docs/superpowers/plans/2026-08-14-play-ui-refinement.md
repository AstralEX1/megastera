# Play UI Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the Play configurator so the desktop Coordinates toggle is a larger left-side handle and the Win up to headline uses the approved Billboard depth treatment.

**Architecture:** Keep the change inside the existing `ExpeditionConfigurator` presentation boundary. The headline remains a `DepthText` instance with the existing animation and color inputs; the disclosure keeps the current right-side desktop panel and bottom mobile disclosure, changing only desktop toggle geometry and typography.

**Tech Stack:** React, TypeScript, Tailwind utility classes, CSS custom properties, Vitest, Testing Library, pnpm.

## Global Constraints

- Do not change ticket selection, approval, purchase, backend generation, or Megapot behavior.
- Keep the existing mobile disclosure below the configurator, including its current labels, state, and panel behavior.
- Use `depth={4}`, `layers={32}`, and `fontWeight={800}` for the Play `DepthText` headline.
- Use `clamp(3.45rem, 5.6vw, 5.3rem)` as the Play Billboard font size.
- Enlarge the desktop Coordinates toggle from `52x160px` to `104x320px` and anchor its right edge to the panel.
- Preserve unrelated worktree changes and do not stage `.playwright-mcp` snapshots.

---

### Task 1: Extend focused regression coverage

**Files:**
- Modify: `src/components/explore/ExpeditionConfigurator.test.tsx`

**Interfaces:**
- Consumes: The existing `ExpeditionConfigurator` rendered DOM, `DepthText` CSS custom properties, and desktop Coordinates toggle styles.
- Produces: Assertions that fail against the current `28`-layer, `1.5px`-depth, `52x160px` implementation and describe the approved target behavior.

- [ ] **Step 1: Update the headline assertions to the approved target values.**

Change the existing live-jackpot test expectations to:

```tsx
expect(container.querySelectorAll('.depth-text__layer')).toHaveLength(32);
expect(container.querySelector('.depth-text')).toHaveStyle({
  '--depth-text-perspective': '1500px',
  '--depth-text-font-size': 'clamp(3.45rem, 5.6vw, 5.3rem)',
  '--depth-text-font-weight': '800',
  '--depth-text-face-color': '#f8fafc',
});
expect(container.querySelector('.depth-text__layer')).toHaveStyle({
  transform: 'translateZ(-128px)',
});
```

- [ ] **Step 2: Add desktop-toggle geometry assertions.**

In the existing desktop toggle test, assert the closed toggle has `h-80` and
`w-[104px]`, uses `left: calc(50% + 368px)`, and contains the proportional
label and arrow utility classes:

```tsx
expect(toggle).toHaveClass('h-80', 'w-[104px]');
expect(toggle).toHaveStyle({ left: 'calc(50% + 368px)' });
expect(toggle.querySelector('.text-\\[1\\.36rem\\]')).toBeInTheDocument();
expect(toggle.querySelector('.text-\\[3rem\\]')).toBeInTheDocument();
```

After opening, assert the toggle uses the safe panel-relative position:

```tsx
expect(closeToggle).toHaveStyle({
  left: 'min(calc(50% + 368px), calc(50% + 50vw - 500px))',
});
```

- [ ] **Step 3: Run the focused test file and confirm the new assertions fail before implementation.**

Run:

```text
pnpm exec vitest run src/components/explore/ExpeditionConfigurator.test.tsx
```

Expected: the test fails only on the old headline layer/style values and old
desktop toggle classes/positions; no unrelated test file should be involved.

- [ ] **Step 4: Commit the test-first assertions.**

```text
git add src/components/explore/ExpeditionConfigurator.test.tsx
git commit -m "test: define Play UI refinement behavior"
```

### Task 2: Implement the approved Play presentation changes

**Files:**
- Modify: `src/components/explore/ExpeditionConfigurator.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: The existing `DepthText`, desktop disclosure, mobile disclosure, and Sora font setup.
- Produces: A 32-layer Billboard headline and a `104x320px` desktop Coordinates toggle whose right edge remains aligned with the panel.

- [ ] **Step 1: Configure the Play `DepthText` headline.**

In `ExpeditionConfigurator.tsx`, update only the live-jackpot `DepthText`
props:

```tsx
layers={32}
depth={4}
fontSize="clamp(3.45rem, 5.6vw, 5.3rem)"
fontWeight={800}
```

Keep the current face color, depth color, tilt, smoothing, perspective,
orbit, pointer, and shadow props unchanged.

- [ ] **Step 2: Make Extra Bold available in the existing Sora import.**

In `src/index.css`, extend the existing Google Fonts Sora weight list from
`500;600;700` to `500;600;700;800`, leaving all other font families and CSS
unchanged.

- [ ] **Step 3: Enlarge and reposition only the desktop Coordinates toggle.**

Update the desktop toggle classes from `h-40 w-[52px]` to `h-80 w-[104px]`.
Keep `hidden ... xl:flex`, the right-side panel, accessibility attributes,
transition behavior, and mobile disclosure unchanged. Use these positions so
the toggle's right edge matches the panel's left edge in both states:

```tsx
left: coordinatesOpen
  ? 'min(calc(50% + 368px), calc(50% + 50vw - 500px))'
  : 'calc(50% + 368px)',
```

Double the arrow class from `text-2xl` to `text-[3rem]` and apply
`text-[1.36rem]` to the vertical Coordinates label while retaining the
existing telemetry uppercase/letter-spacing treatment.

- [ ] **Step 4: Run the focused test file and confirm it passes.**

Run:

```text
pnpm exec vitest run src/components/explore/ExpeditionConfigurator.test.tsx
```

Expected: all `ExpeditionConfigurator` tests pass, including the preserved
coordinates open/close interaction and mobile disclosure rendering.

- [ ] **Step 5: Commit the implementation.**

```text
git add src/components/explore/ExpeditionConfigurator.tsx src/index.css
git commit -m "feat: refine Play configurator UI"
```

### Task 3: Verify repository quality and visual scope

**Files:**
- Inspect only: repository scripts and changed-file diff

**Interfaces:**
- Consumes: The committed Play UI implementation and existing repository verification commands.
- Produces: Local test/build evidence and a separate statement about browser visual validation.

- [ ] **Step 1: Review the final diff and worktree boundaries.**

Run:

```text
git diff HEAD~1 -- src/components/explore/ExpeditionConfigurator.tsx src/components/explore/ExpeditionConfigurator.test.tsx src/index.css
git status --short
```

Confirm that the implementation diff contains only the approved headline,
desktop toggle, font-weight import, and focused test changes. Confirm the
pre-existing API/mining/docs changes and `.playwright-mcp` snapshots remain
unstaged or otherwise untouched by this task.

- [ ] **Step 2: Run the required repository gate.**

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

Record each command's result. If an environment issue blocks a command, report
the exact command and failure separately from successful local checks.

- [ ] **Step 3: Report visual validation separately.**

If the local browser/dev-server path is available, inspect the Play screen at a
desktop viewport and confirm the enlarged toggle is left of Coordinates and
the headline remains readable. Otherwise explicitly state that browser visual
validation was not performed; do not treat HTTP or build success as visual
proof.

- [ ] **Step 4: Commit any verification-only updates only if required.**

Do not create unrelated formatting or generated-file changes. The expected
final implementation commits are the focused test commit and the implementation
commit from Tasks 1 and 2.
