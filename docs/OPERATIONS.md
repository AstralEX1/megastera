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
MEGAPLANETS_WORKER_TOKEN              # required only for the finalize route
```

Frontend values use `VITE_*` only for public configuration, including the wallet/RPC and
optional `VITE_BACKEND_API_BASE_URL`. Never put `DATABASE_URL`, worker tokens, or private
keys in a Vite variable.

## Start and health checks

```sh
pnpm db:generate
pnpm db:validate
pnpm api:server
pnpm api:leaderboard-worker      # scheduler invokes once per day
pnpm dev --host 127.0.0.1
```

Check:

- `GET /api/planets/health` for liveness;
- `GET /api/planets/metrics` for process-local HTTP counters; and
- `GET /api/planets?owner=...` after a confirmed receipt generation.

There is intentionally no readiness route that probes a Planet contract and no
indexer process to start.

## Purchase and generation troubleshooting

The frontend must send the execution transaction hash and exact `TicketPurchased` log
index. The API then checks receipt status, Base Sepolia, canonical jackpot, source tag,
ticket fields, confirmation depth, canonical block hash, and optional recipient.

If generation returns `422`, inspect server logs for the request and RPC stage; do not
retry with a different log index unless the receipt actually contains another canonical
ticket event. Repeating the same valid request is safe: the key is
`originTxHash:logIndex`, and an existing ready row is returned.

If the database already contains a conflicting ticket or Planet row, preserve it and
investigate the immutable provenance mismatch. Do not delete production data as a first
response.

GIFs are stored in PostgreSQL and served with an immutable content hash. A missing GIF is
a failed generation/storage issue, not a reason to fall back to browser-generated media.

## Mining and leaderboard

Mining is lazy:

```text
baseMineralsPerDay × elapsed milliseconds × 1_000_000 / 86_400_000
```

The start time is the backend generation timestamp for the MVP. The browser never writes
accrual or ledger rows. The leaderboard worker finalizes completed UTC days from ready
backend Planet rows; public routes are read-only.

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
