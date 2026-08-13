# Current status

Last reviewed: 2026-08-13. This is the active Megastera hackathon checkpoint.

## Product checkpoint

Implemented in the new repository:

- Base Sepolia Megapot direct checkout for 1–10 tickets and keeper bulk checkout for
  11–50 tickets.
- Receipt-verified `MEGAPLANETS_V1` provenance using the execution receipt and log index.
- Idempotent backend Planet generation linked to `TicketPurchase`.
- Deterministic traits and server-rendered GIF bytes stored in PostgreSQL.
- My Planets collection and detail view backed only by database rows.
- Lazy lifetime mining and daily UTC leaderboard calculations from backend Planets.
- No active Planet NFT, voucher, Pinata, direct holdings, projector, or continuous
  Ticket-indexer path.

## Runtime state

| Layer | State | Remaining risk |
| --- | --- | --- |
| Megapot checkout | Implemented and covered by existing receipt tests | Requires a configured/funded wallet for live verification. |
| Receipt verification | Implemented with confirmation and reorg guards | Live RPC fallback behavior still needs an approved environment check. |
| Backend Planet persistence | Implemented with migration, idempotency, and conflict guards | Requires PostgreSQL migration/application. |
| GIF generation | Implemented through the shared deterministic generator | Large batches are synchronous in this one-day MVP. |
| Mining | Implemented as read-only lazy snapshots | Starts at backend generation time in the MVP. |
| Leaderboard | Backend rows and worker path implemented | Requires scheduler and database. |
| Frontend | Play → backend GIF → My Planets path implemented | Needs real browser/wallet smoke in configured environment. |

## Required environment checks

Configure only `DATABASE_URL`, `BASE_SEPOLIA_RPC_URL`, optional RPC fallbacks,
confirmation depth, CORS origins, and the leaderboard worker token. No Planet contract
address, NFT signer key, deployment block, or Pinata token belongs in the active setup.

## Verification

Run fresh output from the repository root before submission:

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm db:generate
pnpm db:validate
pnpm --filter @megaplanets/planet-generator golden
```

No live transaction, production database, or deployed API claim is implied by local test
success.
