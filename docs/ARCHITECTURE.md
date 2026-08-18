# Megastera architecture

This document describes the active Megastera architecture on Base Sepolia. Historical NFT/indexer experiments remain in git history only; they are not runtime requirements.

## Sources of truth

| Concern | Source of truth | Active consumer |
| --- | --- | --- |
| Ticket purchase and drawing state | Megapot contract and Base Sepolia RPC | wagmi checkout |
| Ticket eligibility | Finalized receipt containing canonical `MEGASTERA` `TicketPurchased` | `api/receiptVerification.ts` |
| Historical ticket status and winnings | Base Sepolia Megapot Data API wallet ticket feed | `src/lib/api.ts` / `useWalletTickets` |
| Planet identity and media | Shared deterministic generator plus `BackendPlanet` row | API and My Planets |
| Planet ownership | `BackendPlanet.ownerAddress`, copied from the verified receipt recipient | API list/mining routes |
| Planet mining | `baseMineralsPerDay` and `generatedAt` | `api/miningStore.ts` |
| Leaderboard | Ready `BackendPlanet.generatedAt` + `baseMineralsPerDay` rows | Live read route with an approximately 60-second backend cache |

## Runtime flow

```text
Megapot receipt
  -> frontend receipt recovery and bounded generation retry
  -> finality and canonical event verification
  -> immutable TicketPurchase persistence
  -> deterministic BackendPlanet derivation
  -> GIF bytes + hash in PostgreSQL
  -> My Planets collection / mining / leaderboard
```

If generation fails after the receipt proof is saved, `GET /api/planets/collection` still returns a pending row. If the receipt is not final yet, the frontend keeps its canonical receipt in local storage and renders the same ticket as pending until the backend catch-up pass can persist and generate it.

Direct purchases use one to ten tickets. Eleven to fifty all-random tickets use the Megapot keeper facilitator. For bulk orders, each execution receipt is processed; the order-creation transaction is never used as Planet provenance. Every ticket remains tied to its immutable `originTxHash:logIndex` key.

The source tag is always `MEGASTERA`. It is a Megapot attribution value and does not refer to a Planet NFT deployment.

## Backend API

`api/index.ts` mounts only:

- backend Planet generation, collection, GIF, and mining routes;
- live leaderboard routes; and
- liveness/metrics routes.

`api/receiptVerification.ts` performs the complete verification sequence against bounded RPC fallbacks: Base Sepolia chain ID, receipt event fields, optional recipient, finalized block depth, canonical block hash, and block timestamp.

`api/prismaTicketPurchase.ts` persists only the immutable ticket row required by backend generation. `api/backendPlanet.ts` derives the deterministic traits and GIF and upserts one row per ticket purchase. Existing ready rows are returned unchanged; conflicting proof fields fail closed. Collection queries filter by Base Sepolia, the active jackpot, and the `MEGASTERA` source tag.

No active module signs vouchers, pins media, reads a Planet contract, projects Planet events, scans all tickets continuously, or writes transfer/accrual ledgers.

## Frontend boundaries

`src/pages/Play.tsx` owns checkout and, after canonical receipt recovery in the purchase hooks, requests backend generation with bounded finality retries. The active UI has two stages: Buy tickets and Explore planets. On success it shows the generated cards full screen with `Explore again` and `My planets` actions.

`src/pages/Planets.tsx` merges the backend collection with locally confirmed site receipts and the complete paginated wallet ticket feed. Site tickets are always represented as a Planet or pending card; unmatched wallet tickets are plain ticket cards. It does not derive inventory from chain holdings or expose mint/reveal controls. `src/hooks/useWalletMining.ts` reads the backend wallet snapshot and locally interpolates no persistent state. The `/tickets` surface uses `useJackpotState` for current-drawing status/countdown and the testnet Data API for wallet ticket/win rows; claims call `Jackpot.claimWinnings` directly after simulation.

The landing experience may render deterministic planet previews for presentation. Those previews are not the authority for a purchased Planet; verified receipt provenance and the persisted backend record remain authoritative.

## Persistence

The `BackendPlanet` model is linked one-to-one to `TicketPurchase` and stores:

- immutable ticket owner and seed/traits hash;
- generator version and deterministic display traits;
- base mining rate and generation timestamp;
- GIF bytes and content hash; and
- ready/failed status plus bounded generation error text.

Legacy Prisma tables and migrations are retained only for database compatibility. No active code writes the legacy Planet, voucher, artifact, projector, or accrual paths.

## Verification map

Run the repository quality gate from the root:

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter @megaplanets/planet-generator golden
pnpm build
pnpm db:generate
pnpm db:validate
```
