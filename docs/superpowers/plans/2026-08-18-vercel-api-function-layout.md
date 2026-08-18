# Vercel API Function Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep Vercel Hobby function discovery below the 12-function limit without changing the API behavior.

**Architecture:** Keep only `api/index.ts` as the Vercel entrypoint. Move backend implementation modules, the local Node server, and their tests to `server/api/`, where they remain part of the Node TypeScript project but are not auto-discovered as Vercel functions. Generate Prisma Client under `server/api/generated/prisma` so generated TypeScript is outside Vercel's `api/` discovery directory.

**Tech Stack:** Vercel Functions, Hono, TypeScript bundler resolution, Prisma 7, Vitest, pnpm 11.

**Spec:** User request in the current task; Vercel function discovery and Hobby limits documented at `https://vercel.com/docs/functions/runtimes`.

## Global Constraints

- Preserve the existing `api/index.ts` default Hono handler and `createApp` named export.
- Do not change frontend behavior, Coming Soon content, API routes, database schema, or generated contract logic.
- Keep `pnpm build`, `pnpm typecheck`, `pnpm test`, and the planet-generator golden suite green.
- Leave only `api/index.ts` as a TypeScript source entrypoint under `api/`.

### Task 1: Add a failing API-layout regression test

**Files:**
- Modify: `vite.config.test.ts`

**Interfaces:**
- Consumes: the repository root and its `api/` directory.
- Produces: a test that fails while helper modules remain directly inside `api/`.

- [ ] Add a Vitest test that reads direct `api/*.ts` files and expects only `index.ts`.
- [ ] Run the focused test and confirm it fails because the current directory contains the existing backend modules and tests.

### Task 2: Move backend implementation outside Vercel discovery

**Files:**
- Move: tracked `api/*.ts` files other than `api/index.ts` to `server/api/`.
- Modify: `api/index.ts` to re-export the moved `createApp` and default handler.
- Modify: `prisma/schema.prisma` to generate into `server/api/generated/prisma`.
- Modify: `package.json` API server scripts to use `server/api/` paths.
- Modify: `tsconfig.node.json` to include `api/index.ts` and `server/**/*.ts`.
- Modify: `server/api/eligibility.ts` relative import to `shared/ticketValidation`.

**Interfaces:**
- Consumes: existing Hono app, backend modules, Prisma imports, and local worker entrypoints.
- Produces: one Vercel function entrypoint with the same default and named exports.

- [ ] Move modules and tests without changing their contents.
- [ ] Add the thin `api/index.ts` adapter and update only paths made stale by the move.
- [ ] Generate Prisma Client at the new path.

### Task 3: Verify and integrate

**Files:**
- Verify: `api/`, `server/api/`, `package.json`, `prisma/schema.prisma`, `tsconfig.node.json`.

- [ ] Run the focused API-layout test and confirm it passes.
- [ ] Run `pnpm install --frozen-lockfile`, database checks, lint, typecheck, all tests, golden tests, and production build on Node 22 + pnpm 11.
- [ ] Confirm the Vercel deployment source contains one direct `api/index.ts` entrypoint.
- [ ] Commit and push only the layout refactor and its regression test.
