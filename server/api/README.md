# Megastera API

The active Hono API verifies finalized Base mainnet Megapot `TicketPurchased` logs,
persists canonical ticket provenance, generates deterministic Planet GIFs, and serves the
database-backed collection, mining, leaderboard, and Megapot Data API proxy.

## HTTP surface

- `GET /api/planets/health` and `/metrics`
- `POST /api/planets/generate` and `/generate/batch`
- `GET /api/planets/collection?owner=...`
- `GET /api/planets?owner=...`
- `GET /api/planets/:planetId` and `/:planetId/gif`
- `GET /api/planets/:planetId/mining`
- `GET /api/wallets/:address/mining`
- `GET /api/leaderboard/current`, `/current/:address`, `/history`, `/days/:periodId`
- `GET /api/megapot/*` (server-authenticated proxy to `https://api.megapot.io/v1`)

Planet vouchers, Pinata/IPFS artifacts, Planet contract reads/writes, direct holdings, and
continuous indexers are not exposed.

## Entrypoints

- `api/index.ts`: the only Vercel Function; restores the catch-all rewrite and calls Hono.
- `server/api/index.ts`: framework-neutral Hono composition.
- `pnpm api:server`: optional standalone Node server for local/runtime diagnostics.

The Vite dev plugin mounts the same Hono app, so `/api/megapot` behavior matches Vercel.

## Required server configuration

`BASE_RPC_URL`, `DATABASE_URL`, and `MEGAPOT_API_KEY` are required for their respective
live paths. `BASE_RPC_FALLBACK_URLS` and `MEGAPLANETS_CONFIRMATIONS` are optional.
`DATABASE_URL` should be a Supabase transaction-pooler URL in Vercel.

## Safety boundary

- Receipt verification accepts only chain `8453`, the canonical mainnet Jackpot, and the
  exact `MEGASTERA` source.
- Request bodies are bounded to 16 KiB.
- Generation is idempotent on `originTxHash:logIndex`; conflicting provenance is rejected.
- GIF bytes are stored in PostgreSQL with an immutable content hash.
- Data API credentials are read only from the server environment.
- The Data API proxy allowlists documented `GET` routes and rate-limits each client per
  warm instance; Vercel Firewall supplies the deployment-wide limit.
- `MEGAPLANETS_ALLOWED_ORIGINS` is an exact allowlist when cross-origin access is needed.
