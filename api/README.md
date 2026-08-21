# Megastera API

The active API verifies finalized Megapot `TicketPurchased` receipt logs, persists the canonical ticket row, generates one deterministic Planet GIF per receipt log, and serves the database-backed collection, live mining snapshots, and current leaderboard. It also exposes the same-origin Megapot Data API proxy.

## HTTP surface

- `GET /api/planets/health`
- `GET /api/planets/metrics`
- `POST /api/planets/generate`
- `POST /api/planets/generate/batch`
- `GET /api/planets?owner=...`
- `GET /api/planets/collection?owner=...`
- `GET /api/planets/:planetId`
- `GET /api/planets/:planetId/gif`
- `POST /api/planets/:planetId/upgrade`
- `GET /api/wallets/:address/mining`
- `GET /api/leaderboard/current?offset=...&limit=...`
- `GET /api/leaderboard/current/:address`
- `GET /api/megapot/*` (proxy to the Base mainnet Megapot Data API)

The batch generation body accepts 1–50 receipt references. Archived leaderboard periods are written by the separate `pnpm api:leaderboard-worker` process but are not exposed by the current HTTP surface. The unauthenticated upgrade endpoint always returns `404`; its persistence primitives remain available for authenticated server-side integration later.

Planet vouchers, Pinata/IPFS artifacts, Planet contract reads/writes, direct holdings, continuous indexers, and leaderboard history/finalization routes are intentionally not exposed.

## Local process

```sh
pnpm api:server
```

The HTTP server defaults to `127.0.0.1:8787`; set `MEGAPLANETS_API_HOST` and `MEGAPLANETS_API_PORT` to override. Backend generation requires `DATABASE_URL` and `BASE_RPC_URL`; optional RPC failover is configured with `BASE_RPC_FALLBACK_URLS`. Set server-only `MEGAPOT_API_KEY` if the proxy should authenticate upstream requests.

## Safety boundary

- `MEGAPLANETS_ALLOWED_ORIGINS` remains an exact CORS allowlist.
- Request bodies are bounded to 16 KiB.
- Batch generation is bounded to 50 receipt references.
- Receipt verification checks Base mainnet, canonical jackpot/source, event fields, confirmation depth, block hash, and optional wallet recipient.
- Generation is idempotent on `originTxHash:logIndex`; conflicting persisted provenance is rejected.
- GIF bytes are stored in PostgreSQL and served with an immutable content hash.
- Leaderboard reads are derived from ready persisted Planet records, collection milestones, and—after cutover—mineral account and upgrade history.
