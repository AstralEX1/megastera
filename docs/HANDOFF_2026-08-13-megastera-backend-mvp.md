# Megastera backend Planet MVP handoff

Date: 2026-08-13
Repository: `https://github.com/AstralEX1/megastera`
Branch: `codex/megastera-backend-planets-mvp`

## Current checkpoint

The new repository is a copy of the existing application with the Planet NFT
mechanics removed from the active runtime. The old `megaplanets` repository is
not used as a destination and was not changed in this stage.

After a confirmed Megapot purchase, the browser sends canonical receipt data to
the backend. The backend verifies the Base Sepolia receipt, persists the ticket
purchase, deterministically generates the planet and GIF, stores the GIF in the
database, and returns a backend Planet record. My Planets and mining read these
records. Ticket purchase, approval, drawing, claim, and leaderboard behavior
remain in place.

## API surface

- `POST /api/planets/generate`
- `POST /api/planets/generate/batch`
- `GET /api/planets?owner=...`
- `GET /api/planets/:planetId`
- `GET /api/planets/:planetId/gif`
- `GET /api/planets/:planetId/mining`
- `GET /api/wallets/:address/mining`
- `GET /api/leaderboard/*`
- `GET /api/planets/health`
- `GET /api/planets/metrics`

Old voucher, readiness, signer, Pinata, direct NFT-holdings, and indexer routes
are retired and return 404 where their paths are still reserved.

## Database

Apply `prisma/migrations/20260813120000_backend_planets/migration.sql` to the
target PostgreSQL database. It adds `BackendPlanet` and its one-to-one relation
to `TicketPurchase`. Existing legacy tables/migrations are intentionally kept
for compatibility but are not part of the active runtime.

Required server variables are documented in `.env.example`, especially
`DATABASE_URL` and `BASE_SEPOLIA_RPC_URL`. Never put server secrets in `VITE_*`
variables or commit `.env.local`.

## Verification completed locally

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test` — 57 files, 184 tests
- `pnpm build`
- `pnpm db:generate`
- `pnpm db:validate`
- `pnpm --filter @megaplanets/planet-generator golden` — 26 tests
- `git diff --check`

The local gates do not prove production database connectivity, receipt verification
against live RPC, browser rendering against a deployed site, or a funded wallet
purchase. Those remain deployment/hackathon verification steps.

## Next operator steps

1. Configure the target PostgreSQL `DATABASE_URL` and Base Sepolia RPC variables.
2. Apply the Prisma migration.
3. Start the API and Vite frontend, then run one funded Base Sepolia purchase.
4. Confirm the receipt generates one planet, refreshes idempotently, appears in My
   Planets, serves a GIF, and accrues mining.
