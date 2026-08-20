# Operations and deployment runbook

This runbook covers the active Megastera backend on Base mainnet and the opt-in mineral-economy-v2 path in this worktree. No Planet contract, NFT signer, Pinata credential, or indexer process is required. Vercel routes `/api/**` to `api/index.ts`; the daily leaderboard finalizer is a separate process.

## Required environment

Server values:

```text
BASE_RPC_URL
BASE_RPC_FALLBACK_URLS               # optional comma-separated URLs
DATABASE_URL
MEGAPLANETS_CONFIRMATIONS=6          # optional, non-negative integer
MEGAPLANETS_ALLOWED_ORIGINS          # optional exact comma-separated origins
MEGAPOT_API_KEY                      # optional server-only key for /api/megapot/*
MEGAPLANETS_API_HOST                 # optional standalone server host
MEGAPLANETS_API_PORT                 # optional standalone server port
MINERAL_ECONOMY_CUTOVER_AT           # optional ISO timestamp; empty keeps V1 wallet mining
MINERAL_UPGRADES_ENABLED=false       # only enables upgrades after a valid cutover
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
- `GET /api/leaderboard/current` for live standings.

There is intentionally no readiness route that probes a Planet contract and no indexer process to start.

## Purchase and generation troubleshooting

The frontend must send the execution transaction hash and exact `TicketPurchased` log index. The API then checks receipt status, Base mainnet, canonical jackpot, `MEGASTERA` source tag, ticket fields, confirmation depth, canonical block hash, and optional recipient. The Play screen retries the same reference while the receipt reaches finality; the backend persists the proof before rendering the GIF, so a generation/storage failure leaves a retryable pending collection row.

If generation returns `422`, inspect server logs for the request and RPC stage; do not retry with a different log index unless the receipt actually contains another canonical ticket event. Repeating the same valid request is safe: the key is `originTxHash:logIndex`, and an existing ready row is returned. If the receipt is not yet final, My Planets keeps the browser-confirmed receipt as a pending card and the catch-up pass retries it later.

If the database already contains a conflicting ticket or Planet row, preserve it and investigate the immutable provenance mismatch. Do not delete production data as a first response.

GIFs are stored in PostgreSQL and served with an immutable content hash. A missing GIF is a failed generation/storage issue, not a reason to fall back to browser-generated media.

## Mining and leaderboard

With no `MINERAL_ECONOMY_CUTOVER_AT`, mining and leaderboard reads follow the V1 lazy/live path:

```text
baseMineralsPerDay × elapsed milliseconds × 1_000_000 / 86_400_000
```

The start time is the backend generation timestamp. Same-type collection milestones apply at 3 (+5%), 5 (+7.5%), and 10 (+10%) matching Planets. The browser never writes accrual or ledger rows. Public leaderboard routes calculate current rows from ready backend Planet `generatedAt` and `baseMineralsPerDay` values, apply the V1 collection calculation, and use an in-process cache for approximately 60 seconds.

When `MINERAL_ECONOMY_CUTOVER_AT` is set and the current time is at or after it, the wallet mining route settles `MineralAccount` balance in integer micros from the cutover forward. New Planet generation settles the owner's account before inserting the new Planet. `MINERAL_UPGRADES_ENABLED=true` additionally enables `POST /api/planets/:planetId/upgrade`; level 1/2/3 target bonuses are +10%/+25%/+50%, and purchases are charged from the settled balance inside a transaction with account/Planet locking. Repeating the same `(planetId, targetLevel)` purchase is idempotent. The route derives the account from the persisted Planet owner and currently has no request-wallet signature/authorization check, so it is not a public ownership boundary.

The cutover migration must be applied before setting the environment variable. The current frontend has no upgrade action; the per-Planet mining route and leaderboard remain V1 calculations, so V2 wallet balances/upgrades must not be treated as leaderboard scores.

### Mineral account backfill

After applying the mineral-economy migration and configuring `MINERAL_ECONOMY_CUTOVER_AT`, inspect the one-shot account backfill with:

```sh
pnpm minerals:backfill --dry-run
```

The command reads READY Planets generated by the cutover, groups them by owner, and reports candidate/existing/missing account counts plus V1 opening-balance totals in integer micros. A dry run does not write accounts. The mutating run is:

```sh
pnpm minerals:backfill
```

It refuses to run when the cutover variable is absent or when PostgreSQL `clock_timestamp()` is before the configured cutover. Account creation is create-only and idempotent: existing `MineralAccount` balances are never reset; concurrent duplicates are skipped. If the configured cutover conflicts with the persisted singleton, the command fails closed. Keep the transaction short and rerun after correcting configuration or clock/migration state.

`pnpm api:leaderboard-worker` is the separate finalization command for completed UTC days; it writes archived `LeaderboardPeriod`/`LeaderboardEntry` rows when scheduled, but no HTTP history/finalization route is exposed.

Ticket status uses `useJackpotState` for the live drawing countdown/phase and the Base mainnet Megapot Data API for wallet ticket/win history. The wallet ticket list follows opaque cursors to completion for My Planets and stops on API errors without showing a false empty collection. `Claim winnings` remains an on-chain `Jackpot.claimWinnings(uint256[])` call after simulation, capped at 50 IDs per batch; confirmed receipts invalidate the wallet ticket/win queries.

## Release gate

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter @megaplanets/planet-generator golden
pnpm build
pnpm db:generate
pnpm db:validate
```

Live funded purchases, production database checks, and browser smoke require an appropriately configured environment. Local green tests verify the repository gate but do not by themselves prove external RPC or deployment availability.
