# Megastera backend Planet MVP handoff

Date: 2026-08-13
Repository: `https://github.com/AstralEX1/megastera`
Branch: `codex/megastera-backend-planets-mvp`

## Current checkpoint

Megastera is the only active destination. The application uses Megapot on Base Sepolia
with the `MEGASTERA` source tag. Planet NFT, voucher, Pinata, direct holdings, and
continuous Ticket indexer paths are not part of the runtime.

The receipt flow is:

1. Direct purchase or keeper-executed bulk purchase completes on-chain.
2. The browser recovers canonical `TicketPurchased` events from the successful receipt.
3. Play shows `Exploring planets…` and retries the receipt reference while the backend
   waits for configured finality.
4. The backend verifies chain, jackpot, source, recipient, event fields, canonical block,
   timestamp, and confirmation depth.
5. Immutable `TicketPurchase` provenance is stored before deterministic Planet generation.
6. The generated traits, mining rate, GIF bytes, and GIF hash are stored in PostgreSQL.

Repeated generation is idempotent on `originTxHash:logIndex` and conflicts fail closed.

## My Planets behavior

`GET /api/planets/collection?owner=...` is the primary inventory read. It filters to
Base Sepolia, the active jackpot, and `MEGASTERA`; old `MEGAPLANETS_V1` rows are not
eligible.

The frontend combines three sources:

- durable server rows: generated Planet or pending generation;
- locally confirmed Megastera receipts: pending until the backend catches up; and
- the complete paginated Base Sepolia Data API wallet ticket feed: unmatched tickets are
  shown as plain ticket cards when available.

This guarantees a failed or not-yet-final generation remains findable. Pending cards offer
retry and refresh behavior. A separate catch-up pass reads wallet ticket transaction
hashes, local pending receipts, canonical RPC receipts, and requests idempotent generation;
it is not a continuous blockchain scanner.

Ticket status, winnings, and claimed state use the Megapot testnet Data API. Live drawing
phase/countdown and write operations use RPC/on-chain contract calls. Mining remains lazy
from immutable backend generation time and base rate. Leaderboard remains a backend live
read with the existing cache behavior.

## Active API surface

- `POST /api/planets/generate`
- `POST /api/planets/generate/batch`
- `GET /api/planets/collection?owner=...`
- `GET /api/planets?owner=...`
- `GET /api/planets/:planetId`
- `GET /api/planets/:planetId/gif`
- `GET /api/planets/:planetId/mining`
- `GET /api/wallets/:address/mining`
- `GET /api/leaderboard/*`
- `GET /api/planets/health`
- `GET /api/planets/metrics`

## Runtime configuration

Server-side generation needs `DATABASE_URL` and `BASE_SEPOLIA_RPC_URL`; optional RPC
fallbacks and the configured confirmation depth are documented in `.env.example` and
`docs/OPERATIONS.md`. The frontend Data API default for Base Sepolia is
`https://api-testnet.megapot.io/v1`; a configured mainnet host is rejected and replaced
with the chain-compatible testnet host.

## Verification

Focused Play/My Planets/collection/Data API tests and `pnpm typecheck` pass at this
checkpoint. Run the complete gate from the repository root before handoff:

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm db:generate
pnpm db:validate
pnpm --filter @megaplanets/planet-generator golden
```

Live funded purchases and backend generation require the configured database/RPC
environment and should be verified separately from local unit/build results.
