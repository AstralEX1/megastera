# Megastera API

The active API verifies finalized Megapot `TicketPurchased` receipt logs, persists the canonical ticket row, generates one deterministic Planet GIF per receipt log, and serves the database-backed collection, mining snapshots, and leaderboard.

## HTTP surface

- `GET /api/planets/health`
- `GET /api/planets/metrics`
- `POST /api/planets/generate`
- `POST /api/planets/generate/batch`
- `GET /api/planets?owner=...`
- `GET /api/planets/:planetId`
- `GET /api/planets/:planetId/gif`
- `GET /api/wallets/:address/mining`
- `GET /api/leaderboard/current`, `/current/:address`, `/history`, `/days/:periodId`

Planet vouchers, Pinata/IPFS artifacts, Planet contract reads/writes, direct holdings, and continuous indexers are intentionally not exposed.

## Local process

```sh
pnpm api:server
```

The HTTP server defaults to `127.0.0.1:8787`; set `MEGAPLANETS_API_HOST` and `MEGAPLANETS_API_PORT` to override. Backend generation requires `DATABASE_URL` and `BASE_RPC_URL`; optional RPC failover is configured with `BASE_RPC_FALLBACK_URLS`.

## Safety boundary

- `MEGAPLANETS_ALLOWED_ORIGINS` remains an exact CORS allowlist.
- Request bodies are bounded to 16 KiB.
- Receipt verification checks Base mainnet, canonical jackpot/source, event fields, confirmation depth, block hash, and optional wallet recipient.
- Generation is idempotent on `originTxHash:logIndex`; conflicting persisted provenance is rejected.
- GIF bytes are stored in PostgreSQL and served with an immutable content hash.
- Leaderboard reads are derived from ready persisted Planet records.
