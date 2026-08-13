# Operations and deployment runbook

This runbook covers the backend-only Megastera MVP on Base Sepolia. No Planet contract,
NFT signer, Pinata credential, or indexer process is required.

## Required environment

Server values:

```text
BASE_SEPOLIA_RPC_URL
BASE_SEPOLIA_RPC_FALLBACK_URLS       # optional comma-separated URLs
DATABASE_URL
MEGAPLANETS_CONFIRMATIONS=6          # optional, non-negative integer
MEGAPLANETS_ALLOWED_ORIGINS           # optional exact comma-separated origins
```

Frontend values use `VITE_*` only for public configuration, including the wallet/RPC and
optional `VITE_BACKEND_API_BASE_URL`. The Megapot Data API defaults to
`https://api-testnet.megapot.io/v1` for Base Sepolia. If `VITE_API_BASE_URL=/api/megapot`
is used, the Vite proxy must target the same testnet host. Never put `DATABASE_URL`,
server tokens, or private keys in a Vite variable.

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
- `GET /api/planets/collection?owner=...` after a confirmed receipt generation.

There is intentionally no readiness route that probes a Planet contract and no
indexer process to start.

## Purchase and generation troubleshooting

The frontend must send the execution transaction hash and exact `TicketPurchased` log
index. The API then checks receipt status, Base Sepolia, canonical jackpot, `MEGASTERA`
source tag, ticket fields, confirmation depth, canonical block hash, and optional
recipient. The Play screen retries the same reference while the receipt reaches finality;
the backend persists the proof before rendering the GIF, so a generation/storage failure
leaves a retryable pending collection row.

If generation returns `422`, inspect server logs for the request and RPC stage; do not
retry with a different log index unless the receipt actually contains another canonical
ticket event. Repeating the same valid request is safe: the key is
`originTxHash:logIndex`, and an existing ready row is returned. If the receipt is not yet
final, My Planets keeps the browser-confirmed receipt as a pending card and the catch-up
pass retries it later.

If the database already contains a conflicting ticket or Planet row, preserve it and
investigate the immutable provenance mismatch. Do not delete production data as a first
response.

GIFs are stored in PostgreSQL and served with an immutable content hash. A missing GIF is
a failed generation/storage issue, not a reason to fall back to browser-generated media.

## Mining and leaderboard

Mining and leaderboard reads are lazy/live:

```text
baseMineralsPerDay × elapsed milliseconds × 1_000_000 / 86_400_000
```

The start time is the backend generation timestamp for the MVP. The browser never writes
accrual or ledger rows. Public leaderboard routes calculate current rows from ready
backend Planet `generatedAt` and `baseMineralsPerDay` values and use an in-process cache
for approximately 60 seconds. Daily snapshot tables/migrations remain for database
compatibility, but daily workers/finalize routes are not active.

Ticket status uses `useJackpotState` for the live drawing countdown/phase and the Base
Sepolia Megapot Data API for wallet ticket/win history. The wallet ticket list follows
opaque cursors to completion for My Planets and stops on API errors without showing a false
empty collection. `Claim winnings` remains an on-chain `Jackpot.claimWinnings(uint256[])`
call after simulation, capped at 50 IDs per batch; confirmed receipts invalidate the
wallet ticket/win queries.

## Release gate

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm db:generate
pnpm db:validate
pnpm --filter @megaplanets/planet-generator golden
```

Live funded purchases, production database checks, and browser smoke require a separately
approved environment. Local green tests do not claim live RPC or deployment readiness.
