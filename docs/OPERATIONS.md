# Operations and deployment runbook

This runbook covers the active Megastera backend on Base mainnet and the opt-in mineral-economy-v2 path in this worktree. No Planet contract, NFT signer, Pinata credential, or indexer process is required. Vercel routes `/api/**` to `api/index.ts`; the daily leaderboard finalizer is a separate process.

## Required environment

Server values:

```text
BASE_RPC_URL
BASE_RPC_FALLBACK_URLS               # optional comma-separated URLs
DATABASE_URL
DIRECT_URL                           # optional direct PostgreSQL URL; preparation/migrations fall back to DATABASE_URL
MEGAPLANETS_CONFIRMATIONS=6          # optional, non-negative integer
MEGAPLANETS_ALLOWED_ORIGINS          # optional exact comma-separated origins
MEGAPOT_API_KEY                      # optional server-only key for /api/megapot/*
MEGAPLANETS_API_HOST                 # optional standalone server host
MEGAPLANETS_API_PORT                 # optional standalone server port
MINERAL_ECONOMY_CUTOVER_AT           # optional exact UTC-midnight ISO timestamp; empty keeps V1
MINERAL_UPGRADES_ENABLED=false       # reserved; public upgrades remain server-disabled
GALAXY_PULSE_START_BLOCK             # optional first JackpotSettled block; empty disables Galaxy Pulse
CRON_SECRET                           # required by the protected Vercel leaderboard worker Cron
```

Frontend values use `VITE_*` only for public configuration, including `VITE_CHAIN`, wallet/RPC settings, `VITE_API_BASE_URL`, and optional `VITE_BACKEND_API_BASE_URL`. The Megapot Data API defaults to `https://api.megapot.io/v1` for Base mainnet. If `VITE_API_BASE_URL=/api/megapot` is used, the checked-in proxy targets that same mainnet host and may use server-only `MEGAPOT_API_KEY`. Never put `DATABASE_URL`, server tokens, or private keys in a Vite variable.

## Start and health checks

```sh
pnpm db:generate
pnpm db:validate
pnpm api:server
pnpm dev --host 127.0.0.1
```

Check:

- `GET /api/planets/health` for liveness;
- `GET /api/planets/metrics` for process-local HTTP counters; and
- `GET /api/planets/collection?owner=...` after a confirmed receipt generation;
- `GET /api/leaderboard/current` for live standings; and
- `/api/megapot/*` for the same-origin Megapot Data API proxy.

There is intentionally no readiness route that probes a Planet contract. In production, Vercel Cron calls `/api/internal/leaderboard-worker` daily at 00:05 UTC with `CRON_SECRET`; the endpoint runs the same idempotent leaderboard worker used by `pnpm api:leaderboard-worker`.

## Purchase and generation troubleshooting

The frontend must send the execution transaction hash and exact `TicketPurchased` log index. The API then checks receipt status, Base mainnet, canonical jackpot, `MEGASTERA` source tag, ticket fields, confirmation depth, canonical block hash, and optional recipient. The Play screen retries the same reference while the receipt reaches finality; the backend persists the proof before rendering the GIF, so a generation/storage failure leaves a retryable pending collection row.

Play checkout checks the current USDC allowance against the exact purchase total before showing the purchase action. If the allowance is insufficient, the approval transaction grants a reusable allowance to the route-specific Megapot spender; bulk-order simulation runs only after that approval gate resolves. The UI distinguishes insufficient USDC balance, a rejected wallet transaction, and wallet/network failures.

If generation returns `422`, inspect server logs for the request and RPC stage; do not retry with a different log index unless the receipt actually contains another canonical ticket event. Repeating the same valid request is safe: the key is `originTxHash:logIndex`, and an existing ready row is returned. If the receipt is not yet final, My Planets keeps the browser-confirmed receipt as a pending card and the catch-up pass retries it later.

If the database already contains a conflicting ticket or Planet row, preserve it and investigate the immutable provenance mismatch. Do not delete production data as a first response.

GIFs are stored in PostgreSQL and served with an immutable content hash. A missing GIF is a failed generation/storage issue, not a reason to fall back to browser-generated media.

## Mining and leaderboard

With no `MINERAL_ECONOMY_CUTOVER_AT`, mining and leaderboard reads follow the V1 lazy/live path:

```text
baseMineralsPerDay × elapsed milliseconds × 1_000_000 / 86_400_000
```

The start time is the backend generation timestamp. The base rate is `baseMineralsPerDay × 1_000_000` micros/day. Same-type collection milestones apply at 3 (+5%), 5 (+7.5%), and 10 (+10%) matching Planets. Earned micros are calculated over each rate interval with integer arithmetic; the browser only interpolates the returned snapshot for display and never writes accrual or ledger rows. Before cutover, public leaderboard routes calculate current rows from ready backend Planet `generatedAt` and `baseMineralsPerDay` values and apply the V1 collection calculation. Live leaderboard reads are uncached.

When the prepared cutover is active, the wallet mining route settles `MineralAccount` balance in integer micros from the cutover forward. New Planet generation settles the owner's account before inserting the new Planet. Level 1/2/3 persistence primitives retain +10%/+25%/+50% bonuses and idempotent `(planetId, targetLevel)` charges, but `POST /api/planets/:planetId/upgrade` remains server-disabled until owner-bound authorization exists. A configured cutover that was not persisted before PostgreSQL reaches it fails closed.

The cutover migration must be applied before setting the environment variable. Before cutover, the current leaderboard remains V1; after cutover, it ranks spendable mineral scores reconstructed as opening balance plus historical production minus upgrade costs, and reports the effective per-day rate after collection, upgrade, and Galaxy Pulse events.

Galaxy Pulse starts strictly at `GALAXY_PULSE_START_BLOCK`; there is no historical backfill. The leaderboard worker verifies finalized `JackpotSettled` receipts, derives a deterministic seed from `drawingId` and `winningNumbers`, and advances the sole indexer cursor. Wallet mining reads only the latest authoritative database snapshot. Balance mutations and leaderboard finalization fail closed until the database round matches the current settled drawing reported by the Megapot Data API.

### Cutover preparation

After applying the migration chain, choose one exact future UTC-midnight timestamp and validate it against PostgreSQL time:

```sh
pnpm minerals:prepare --dry-run --cutover-at <UTC_MIDNIGHT_ISO>
pnpm minerals:prepare --cutover-at <UTC_MIDNIGHT_ISO>
```

The preparation command is the only path that deliberately persists the immutable `MineralEconomyCutover` singleton. Ordinary reads and mutations fail closed on a configured/persisted timestamp conflict; do not update or delete the singleton manually.

### Mineral account backfill

After applying the mineral-economy migration and configuring `MINERAL_ECONOMY_CUTOVER_AT`, inspect the one-shot account backfill with:

```sh
pnpm minerals:backfill:dry-run
```

The command reads READY Planets generated by the cutover, groups them by owner, and reports candidate/existing/missing account counts plus V1 opening-balance totals in integer micros. A dry run does not write accounts. The mutating run is:

```sh
pnpm minerals:backfill
```

It refuses to run when the cutover variable is absent or when PostgreSQL `clock_timestamp()` is before the configured cutover. Account creation is create-only and idempotent: existing `MineralAccount` balances are never reset; concurrent duplicates are skipped. If the configured cutover conflicts with the persisted singleton, the command fails closed. Keep the transaction short and rerun after correcting configuration or clock/migration state.

`pnpm api:leaderboard-worker` first ingests finalized Galaxy Pulse rounds, then finalizes completed UTC days. It writes archived `LeaderboardPeriod`/`LeaderboardEntry` rows when scheduled, but no HTTP history/finalization or separate Galaxy Pulse route is exposed.

Ticket status uses `useJackpotState` for the live drawing countdown/phase and the Base mainnet Megapot Data API for wallet ticket/win history. The wallet ticket list follows opaque cursors to completion for My Planets and stops on API errors without showing a false empty collection. `Claim winnings` remains an on-chain `Jackpot.claimWinnings(uint256[])` call after simulation, capped at 50 IDs per batch; confirmed receipts invalidate the wallet ticket/win queries.

## Release gate

```sh
pnpm db:generate
pnpm db:validate
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter @megaplanets/planet-generator golden
pnpm build
```

The PostgreSQL-specific CI job additionally runs `pnpm db:migrate:deploy` against a fresh PostgreSQL 16 service and then `pnpm test:postgres`. The local default test command skips that suite when `MINERAL_ECONOMY_TEST_DATABASE_URL` is not configured.

Live funded purchases, production database checks, and browser smoke require an appropriately configured environment. Local green tests verify the repository gate but do not by themselves prove external RPC or deployment availability.
