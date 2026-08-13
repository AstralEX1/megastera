# Backend Planets MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace on-chain Planet NFT minting with receipt-verified backend Planet records and stored GIF media while preserving Megapot checkout, claims, lifetime mining, and the daily leaderboard.

**Architecture:** `TicketPurchased` receipt verification remains the creation authority. A new `BackendPlanet` row is created once per `originTxHash:logIndex`, stores deterministic traits, owner, mining start time, and GIF bytes, and is read by the API and frontend. Legacy NFT/voucher/Pinata/projector code is removed from the active runtime and may remain only in historical migrations until a later database cleanup.

**Tech Stack:** TypeScript, Hono, Prisma/PostgreSQL, viem, React, TanStack Query, wagmi, `@megaplanets/planet-generator`, pnpm, Vitest.

## Global Constraints

- Target Base Sepolia (`chainId 84532`) only.
- Accept only finalized `TicketPurchased` receipts with source `MEGAPLANETS_V1`.
- Assign `ownerAddress` from the canonical event recipient; do not add application auth or transfer settlement.
- Generate media synchronously for the MVP and store GIF bytes in PostgreSQL; no Pinata, IPFS, WebM, signer, voucher, or Planet contract call remains in the active path.
- Use the existing deterministic generator and `renderPlanetGif`; do not generate previews from browser-only state for My Planets.
- Use `generatedAt` and `baseMineralsPerDay` for the existing lifetime mining formula; never write accrual rows.
- Preserve Megapot allowance, dynamic parameters, receipt decoding, claims, and `MEGAPLANETS_V1` invariants.
- Never copy `.env.local`, `env.local`, private keys, database URLs, or generated `api/generated` output into commits.
- Use pnpm and run the repository verification gate before push.

---

### Task 1: Add backend Planet persistence and deterministic generation

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260813120000_backend_planets/migration.sql`
- Create: `api/backendPlanet.ts`
- Modify: `api/prismaEligibilityStore.ts`
- Modify: `api/store.ts`
- Test: `api/backendPlanet.test.ts`
- Test: `api/prismaBackendPlanetStore.test.ts`

**Interfaces:**
- Consumes: normalized `MegasteraProof` from `api/eligibility.ts` and `TicketPurchase` rows persisted by `PrismaEligibilityStore`.
- Produces: `BackendPlanetRecord`, `BackendPlanetStore`, `deriveBackendPlanet(proof, now)`, `generatePlanet(proof)`, `listPlanets(owner)`, `getPlanet(planetId)`, and `getGif(planetId)`.

- [ ] **Step 1: Define the Prisma model and migration.**

  Add `BackendPlanetStatus` with `READY` and `FAILED`, and add `BackendPlanet` with `ticketPurchaseId @unique`, `chainId`, `ticketId`, `ownerAddress`, deterministic `seed`, `traitsHash`, `generatorVersion`, `planetName`, `planetType`, `terrain`, `rarity`, `satelliteCount`, `hasRing`, `baseMineralsPerDay`, `generatedAt`, `status`, optional `gifData Bytes`, optional `gifHash`, optional `generationError`, and timestamps. Relate it one-to-one to `TicketPurchase` as `backendPlanet`. Add indexes on `(ownerAddress, generatedAt)` and `(status, createdAt)`. Keep legacy NFT tables out of all new runtime queries.

- [ ] **Step 2: Write failing generator/store tests.**

  Assert that the same proof and fixed `now` produce the same seed, traits, GIF hash, and rate; a second generation returns the same planet ID without a duplicate; a different proof creates a different row; and a stored GIF is returned as `image/gif` bytes. Assert that a proof not persisted in `TicketPurchase` is rejected.

- [ ] **Step 3: Implement `deriveBackendPlanet`.**

  Build the existing canonical generator input from `ticketId`, `drawingId`, `normals`, `bonusBall`, and `originTxHash`. Call `createPlanetConfig`, `derivePlanet`, `derivePlanetPreview`, and `renderPlanetGif`. Persist `keccak256(gif)` and the descriptor fields. Use `generatedAt = now` as the mining start.

- [ ] **Step 4: Implement the Prisma and memory stores.**

  `generatePlanet` must look up the proof relation by `(chainId, originTxHash, logIndex)`, return an existing `READY` row, or upsert a failed row/retry into `READY` under the unique `ticketPurchaseId`. Serialize bigints and bytes at the API boundary. `listPlanets` must filter by normalized recipient and return only ready rows; `getGif` must return a copy of the stored bytes and hash.

- [ ] **Step 5: Run the focused tests.**

  Run `pnpm exec vitest run api/backendPlanet.test.ts api/prismaBackendPlanetStore.test.ts` and expect all new tests to pass.

- [ ] **Step 6: Commit the persistence slice.**

  ```bash
  git add prisma/schema.prisma prisma/migrations/20260813120000_backend_planets/migration.sql api/backendPlanet.ts api/prismaEligibilityStore.ts api/store.ts api/backendPlanet.test.ts api/prismaBackendPlanetStore.test.ts
  git commit -m "feat: persist backend-generated planets"
  ```

### Task 2: Replace voucher/NFT routes with receipt generation and backend Planet reads

**Files:**
- Modify: `api/config.ts`
- Modify: `api/index.ts`
- Modify: `api/stage2Config.ts`
- Modify: `api/stage2.ts`
- Modify: `api/miningStore.ts`
- Modify: `api/leaderboardStore.ts`
- Modify: `api/leaderboardWorker.ts`
- Modify: `api/index.test.ts`
- Modify: `api/stage2.test.ts`
- Modify: `api/miningStore.test.ts`
- Modify: `api/leaderboardStore.test.ts`
- Create: `api/backendPlanetRoutes.test.ts`

**Interfaces:**
- Consumes: `BackendPlanetStore` from Task 1 and `findTicketFromReceipt`/`MegasteraVerifier` from `api/index.ts` and `api/eligibility.ts`.
- Produces: `POST /api/planets/generate`, `POST /api/planets/generate/batch`, `GET /api/planets?owner=`, `GET /api/planets/:planetId`, and `GET /api/planets/:planetId/gif`; mining and leaderboard use `BackendPlanet` rows without contract scope.

- [ ] **Step 1: Write failing route tests.**

  Test malformed generation requests return `400`; failed receipt verification returns `422`; a valid proof is persisted and returns a serialized backend Planet; retry returns the same `planetId`; owner listing excludes another wallet; unknown Planet and GIF return `404`; and GIF responses have `content-type: image/gif`.

- [ ] **Step 2: Simplify server configuration/readiness.**

  Keep RPC, fallback RPC, database, confirmation depth, and launch boundary. Remove signer, Pinata, contract-address, deployment-block, metadata-signer, and NFT readiness requirements. Readiness must probe the database and Base Sepolia chain only.

- [ ] **Step 3: Implement generation routes.**

  Parse `{ transactionHash, logIndex, recipient? }` with bounded JSON. Re-fetch the receipt using `findTicketFromReceipt`, save the normalized proof, and call the backend Planet store. The batch route accepts 1–50 references and preserves input order. Use the existing process-local rate/work limiters, but name them for Planet generation rather than vouchers.

- [ ] **Step 4: Switch Stage 2 API and mining.**

  Replace decimal `tokenId` scope checks with UUID `planetId` validation. Wallet and Planet mining queries select `BackendPlanet.id`, `baseMineralsPerDay`, and `generatedAt`; return the existing serialized mining shape with `planetId` as the identifier and `activeSince = generatedAt`.

- [ ] **Step 5: Switch leaderboard persistence reads.**

  Replace `prisma.planet` queries in `finalizeLeaderboardPeriod` and `ensureOverdueLeaderboardPeriodsFinalized` with ready `prisma.backendPlanet` rows and map `generatedAt` to the existing lifetime calculation input. Preserve UTC period boundaries, ranking, and idempotent snapshots.

- [ ] **Step 6: Run backend focused tests.**

  Run `pnpm exec vitest run api/index.test.ts api/backendPlanetRoutes.test.ts api/stage2.test.ts api/miningStore.test.ts api/leaderboardStore.test.ts` and expect all tests to pass.

- [ ] **Step 7: Commit the API/mining slice.**

  ```bash
  git add api/config.ts api/index.ts api/stage2Config.ts api/stage2.ts api/miningStore.ts api/leaderboardStore.ts api/leaderboardWorker.ts api/index.test.ts api/backendPlanetRoutes.test.ts api/stage2.test.ts api/miningStore.test.ts api/leaderboardStore.test.ts
  git commit -m "feat: expose backend planet generation API"
  ```

### Task 3: Connect checkout to generation and replace My Planets inventory

**Files:**
- Modify: `src/lib/backendApi.ts`
- Create: `src/hooks/useBackendPlanets.ts`
- Modify: `src/hooks/useBuyTickets.ts`
- Modify: `src/hooks/useBulkPurchase.ts`
- Modify: `src/pages/Play.tsx`
- Modify: `src/pages/Planets.tsx`
- Modify: `src/hooks/useWalletMining.ts`
- Create or modify: `src/components/planets/BackendPlanetCard.tsx`
- Test: `src/lib/backendApi.test.ts`
- Test: `src/hooks/useBackendPlanets.test.ts`
- Modify: `src/pages/Play.test.tsx`
- Modify: `src/pages/Planets.test.tsx`

**Interfaces:**
- Consumes: serialized `BackendPlanetRecord` and generation routes from Task 2; confirmed `PurchasedTicket` records from `useBuyTickets` and `useBulkPurchase`.
- Produces: a query keyed by wallet that lists backend Planets, a mutation that posts one receipt reference, and a My Planets UI that renders `gifUrl` and mining data without NFT controls.

- [ ] **Step 1: Write failing frontend API tests.**

  Validate backend Planet response parsing, generation request serialization, bounded batch behavior, and that `gifUrl` is derived from the backend base URL rather than a client-generated asset.

- [ ] **Step 2: Implement `useBackendPlanets` and generation helpers.**

  Add `fetchBackendPlanets(address)`, `generateBackendPlanet(ticket)`, and a TanStack Query hook. On `direct.purchasedTickets` or `bulk.confirmedTickets`, post each canonical `originTxHash/logIndex` exactly once, surface generation failures, and invalidate the wallet Planet/mining queries after success.

- [ ] **Step 3: Replace Play reveal/mint orchestration.**

  Keep `ExpeditionConfigurator`, direct/keeper purchase, approval, progress, and claim-related ticket state. Remove `useEligiblePlanetTickets`, `useIndexedPlanets`, client Planet derivation for the inventory, `MintPlanetButton`, `MintPlanetBatchButton`, voucher calls, and reveal transaction state. Show a generating state and server-backed result cards with a link to My Planets.

- [ ] **Step 4: Replace Planets inventory.**

  Read only `useBackendPlanets(address)`. Render each server GIF with an `<img>` URL, ticket ID/receipt link, deterministic name/type/rarity/rate, and the existing live mining overlay. Keep empty/loading/error/retry states and the existing route detail behavior using `planetId`; no tokenId, contract address, ownerOf, tokenURI, or mint CTA remains.

- [ ] **Step 5: Update mining hook/types and tests.**

  Rename the serialized identifier to `planetId` while retaining the response math fields. Update focused tests for wallet snapshots, generation invalidation, and the empty/error inventory states.

- [ ] **Step 6: Run frontend focused tests.**

  Run `pnpm exec vitest run src/lib/backendApi.test.ts src/hooks/useBackendPlanets.test.ts src/pages/Play.test.tsx src/pages/Planets.test.tsx` and expect all tests to pass.

- [ ] **Step 7: Commit the frontend slice.**

  ```bash
  git add src/lib/backendApi.ts src/hooks/useBackendPlanets.ts src/hooks/useBuyTickets.ts src/hooks/useBulkPurchase.ts src/pages/Play.tsx src/pages/Planets.tsx src/hooks/useWalletMining.ts src/components/planets/BackendPlanetCard.tsx src/lib/backendApi.test.ts src/hooks/useBackendPlanets.test.ts src/pages/Play.test.tsx src/pages/Planets.test.tsx
  git commit -m "feat: show backend planets after ticket purchase"
  ```

### Task 4: Remove active NFT/indexer runtime and update project identity/docs

**Files:**
- Modify: `package.json`
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/STATUS.md`
- Modify: `docs/OPERATIONS.md`
- Modify: `api/README.md`
- Modify: `AGENTS.md`
- Remove from active runtime: `api/planetIndexerMain.ts`, `api/planetIndexerRunner.ts`, `api/planetIndexerWorker.ts`, `api/planetIndexer.ts`, `api/planetMintProvenance.ts`, `api/voucher.ts`, `api/service.ts`, `api/pinata.ts`, `api/holdings.ts`, `src/lib/planetVoucher.ts`, `src/lib/planetReveal.ts`, `src/hooks/useIndexedPlanets.ts`, `src/components/planets/MintPlanetButton.tsx`, `src/components/planets/MintPlanetBatchButton.tsx`, and their tests when no longer imported.

**Interfaces:**
- Consumes: the route/frontend migrations from Tasks 2–3.
- Produces: a Megastera repository whose active scripts, docs, environment contract, and UI no longer advertise or start the Planet NFT/indexer path.

- [ ] **Step 1: Run the NFT/indexer reference audit.**

  Use `rg` excluding `node_modules`, `dist`, and `.git` to enumerate remaining references to `MEGAPLANETS_CONTRACT_ADDRESS`, `PLANET_DEPLOYMENT`, vouchers, Pinata, `ownerOf`, `tokenURI`, `PlanetMinted`, `Transfer`, `api:indexer`, and `tokenId`. Classify each hit as active, legacy schema/migration, or test-only before deleting.

- [ ] **Step 2: Remove active imports/scripts and obsolete tests.**

  Delete only files no longer reachable from `src/main.tsx`, `api/serverMain.ts`, or the leaderboard worker. Keep historical Prisma migration SQL and contract source as archive evidence, but do not import them from runtime code.

- [ ] **Step 3: Update identity and operational docs.**

  Rename product references to Megastera, rewrite the flow as purchase → receipt → backend Planet → GIF → mining, remove NFT deployment/readiness instructions, and document only `DATABASE_URL`, Base Sepolia RPC/fallbacks, confirmation depth, API host/port, CORS, and leaderboard worker token.

- [ ] **Step 4: Run a clean reference audit.**

  Require zero active runtime hits for voucher signing, Pinata, Planet contract reads/writes, direct holdings, Planet event projector, and `api:indexer`; allow historical migration/archive text only when clearly labeled.

- [ ] **Step 5: Commit the removal slice.**

  ```bash
  git add -A
  git commit -m "refactor: remove active planet NFT runtime"
  ```

### Task 5: Full verification and handoff

**Files:**
- Modify: `docs/STATUS.md`
- Create: `docs/HANDOFF_2026-08-13-megastera-backend-mvp.md`

- [ ] **Step 1: Generate Prisma client and validate schema.**

  Run `pnpm db:generate` and `pnpm db:validate`.

- [ ] **Step 2: Run repository gates.**

  Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`. Record exact failures and distinguish local dependency/config blockers from code failures.

- [ ] **Step 3: Run the generator golden suite.**

  Run `pnpm --filter @megaplanets/planet-generator golden` to confirm the shared deterministic renderer was not changed unexpectedly.

- [ ] **Step 4: Review the final diff and secrets.**

  Run `git diff --check`, `git status --short`, and a tracked-file scan for `.env.local`, `env.local`, private-key names, database URLs, and Pinata tokens. Confirm the old `megaplanets` remote is absent from the new checkout.

- [ ] **Step 5: Document observable behavior.**

  Record the new checkout path, branch, API endpoints, database migration, verification output, known live-environment blockers, and the exact demo flow. Do not claim live Base Sepolia or production validation without performing it.

- [ ] **Step 6: Push only the new repository.**

  ```bash
  git push -u origin codex/megastera-backend-planets-mvp
  ```

  Verify with `git remote -v` and `git ls-remote --heads origin`. Do not push, fetch, or alter the old `megaplanets` remote.
