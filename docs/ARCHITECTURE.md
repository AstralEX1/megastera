# Megastera architecture

This document describes the active one-day MVP. Historical NFT/indexer plans remain in
git history only; they are not runtime requirements.

## Sources of truth

| Concern | Source of truth | Active consumer |
| --- | --- | --- |
| Ticket purchase and drawing state | Megapot contract and Base Sepolia RPC | wagmi checkout |
| Ticket eligibility | Finalized receipt containing canonical `MEGAPLANETS_V1` `TicketPurchased` | `api/receiptVerification.ts` |
| Planet identity and media | Shared deterministic generator plus `BackendPlanet` row | API and My Planets |
| Planet ownership | `BackendPlanet.ownerAddress`, copied from the verified receipt recipient | API list/mining routes |
| Planet mining | `baseMineralsPerDay` and `generatedAt` | `api/miningStore.ts` |
| Leaderboard | PostgreSQL daily UTC snapshots | Explicit leaderboard worker |

## Runtime flow

```text
Megapot receipt
  -> confirmation and canonical event verification
  -> TicketPurchase persistence
  -> deterministic BackendPlanet derivation
  -> GIF bytes + hash in PostgreSQL
  -> My Planets / mining / leaderboard
```

Direct purchases use one to ten tickets. Eleven to fifty all-random tickets use the
Megapot keeper facilitator. For bulk orders, each execution receipt is processed; the
order-creation transaction is never used as Planet provenance. Every ticket remains tied
to its immutable `originTxHash:logIndex` key.

The source tag is always `MEGAPLANETS_V1`. It is a Megapot attribution value and does not
refer to a Planet NFT deployment.

## Backend API

`api/index.ts` mounts only:

- backend Planet generation, collection, GIF, and mining routes;
- daily leaderboard routes; and
- liveness/metrics routes.

`api/receiptVerification.ts` performs the complete verification sequence against bounded
RPC fallbacks: Base Sepolia chain ID, receipt event fields, optional recipient, finalized
block depth, canonical block hash, and block timestamp.

`api/prismaTicketPurchase.ts` persists only the immutable ticket row required by backend
generation. `api/backendPlanet.ts` derives the deterministic traits and GIF and upserts
one row per ticket purchase. Existing ready rows are returned unchanged; conflicting
proof fields fail closed.

No active module signs vouchers, pins media, reads a Planet contract, projects Planet
events, scans all tickets continuously, or writes transfer/accrual ledgers.

## Frontend boundaries

`src/pages/Play.tsx` owns checkout and, after canonical receipt recovery in the purchase
hooks, requests backend generation. It shows generation progress and server GIFs.

`src/pages/Planets.tsx` reads `useBackendPlanets` only. It does not derive inventory from
chain holdings or expose mint/reveal controls. `src/hooks/useWalletMining.ts` reads the
backend wallet snapshot and locally interpolates no persistent state.

The Lab and landing hero may still render deterministic previews for product exploration;
those previews are not the authority for a purchased Planet.

## Persistence

The new `BackendPlanet` model is linked one-to-one to `TicketPurchase` and stores:

- immutable ticket owner and seed/traits hash;
- generator version and deterministic display traits;
- base mining rate and generation timestamp;
- GIF bytes and content hash; and
- ready/failed status plus bounded generation error text.

Legacy Prisma tables and migrations are retained only for database compatibility. No
active code writes the legacy Planet, voucher, artifact, projector, or accrual paths.

## Verification map

Run the repository gate from the root:

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm db:generate
pnpm db:validate
pnpm --filter @megaplanets/planet-generator golden
```
