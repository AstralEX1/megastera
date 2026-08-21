# Megastera architecture

This document describes the active Megastera architecture on Base mainnet and the opt-in mineral-economy-v2 path in this worktree. Legacy NFT/indexer models and migrations remain for database compatibility; they are not runtime requirements or active write paths.

## Sources of truth

| Concern | Source of truth | Active consumer |
| --- | --- | --- |
| Ticket purchase and drawing state | Megapot contract and Base mainnet RPC | wagmi checkout |
| Ticket eligibility | Finalized receipt containing canonical `MEGASTERA` `TicketPurchased` | `server/api/receiptVerification.ts` |
| Historical ticket status and winnings | Base mainnet Megapot Data API wallet ticket feed | `src/lib/api.ts` / `useWalletTickets` |
| Planet identity and media | Shared deterministic generator plus `BackendPlanet` row | API and My Planets |
| Planet ownership | `BackendPlanet.ownerAddress`, copied from the verified receipt recipient | API list/wallet mining route |
| Planet mining | V1 `baseMineralsPerDay`/`generatedAt` calculation before cutover; V2 `MineralAccount`, collection events, and upgrade history after cutover | `server/api/miningStore.ts` / `mineralEconomy.ts` |
| Current leaderboard | V1 live rows before cutover; after cutover, opening balance + historical production − persisted upgrade costs | `server/api/leaderboardStore.ts` / `leaderboardRoutes.ts` |
| Mineral economy cutover | Exact UTC-midnight configuration reconciled with the persisted `MineralEconomyCutover` row and PostgreSQL clock | `server/api/backendConfig.ts` / `mineralAccounts.ts` |
| Archived leaderboard periods | `LeaderboardPeriod` and `LeaderboardEntry` rows written by the standalone finalization worker | Database/worker only; no archived-period HTTP route is mounted |

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

Direct purchases use one to ten tickets. Eleven to fifty ticket expeditions use the Megapot keeper facilitator; up to ten tickets may carry selected coordinates and the rest are dynamic. For bulk orders, each execution receipt is processed; the order-creation transaction is never used as Planet provenance. Every ticket remains tied to its immutable `originTxHash:logIndex` key.

When `MINERAL_ECONOMY_CUTOVER_AT` is absent or still in the future, wallet mining and current leaderboard reads use the V1 live calculation. Once the cutover is active, current leaderboard reads reconstruct each wallet's spendable score as opening balance plus historical production minus upgrade purchase costs, with collection and upgrade events changing the effective rate at their event times. The post-cutover read is computed from a repeatable-read database transaction.

The source tag is always `MEGASTERA`. It is a Megapot attribution value and does not refer to a Planet NFT deployment.

## Backend API

The Vercel entrypoint `api/index.ts` delegates to `server/api/index.ts`, which mounts only:

- backend Planet generation, collection, GIF, and wallet mining routes;
- the server-disabled Planet upgrade endpoint;
- live leaderboard routes;
- the same-origin `/api/megapot/*` proxy for the Megapot Data API; and
- liveness/metrics routes.

`server/api/receiptVerification.ts` performs the complete verification sequence against bounded RPC fallbacks: Base mainnet chain ID, receipt event fields, optional recipient, finalized block depth, canonical block hash, and block timestamp.

`server/api/prismaTicketPurchase.ts` persists only the immutable ticket row required by backend generation. `server/api/backendPlanet.ts` derives the deterministic traits and GIF and upserts one row per ticket purchase. Existing ready rows are returned unchanged; conflicting proof fields fail closed. Collection queries filter by Base mainnet, the active jackpot, and the `MEGASTERA` source tag.

No active module signs vouchers, pins media, reads a Planet contract, projects Planet events, scans all tickets continuously, or writes transfer/accrual ledgers. The upgrade endpoint remains server-disabled because it does not yet verify a request-wallet signature.

## Frontend boundaries

`src/pages/Play.tsx` owns checkout and, after canonical receipt recovery in the purchase hooks, requests backend generation with bounded finality retries. The active UI has two stages: Buy tickets and Explore planets. On success it shows the generated cards full screen with `Explore again` and `My planets` actions.

`src/pages/Planets.tsx` merges the backend collection with locally confirmed site receipts and the complete paginated wallet ticket feed. Site tickets are always represented as a Planet or pending card; unmatched wallet tickets are plain ticket cards. It does not derive inventory from chain holdings or expose mint/reveal controls. `src/hooks/useWalletMining.ts` reads and validates the backend wallet snapshot, including current balance and upgrade state, and locally interpolates no persistent state. Upgrade controls remain hidden because the backend reports `upgradesEnabled: false`. The `/tickets` surface uses `useJackpotState` for current-drawing status/countdown and the Base mainnet Data API for wallet ticket/win rows; claims call `Jackpot.claimWinnings` directly after simulation.

The landing experience may render deterministic planet previews for presentation. Those previews are not the authority for a purchased Planet; verified receipt provenance and the persisted backend record remain authoritative.

## Persistence

The `BackendPlanet` model is linked one-to-one to `TicketPurchase` and stores:

- immutable ticket owner and seed/traits hash;
- generator version and deterministic display traits;
- base mining rate and generation timestamp;
- GIF bytes and content hash; and
- ready/failed status plus bounded generation error text.

This worktree additionally stores `upgradeLevel` and `upgradeBonusBps` on `BackendPlanet`, opening/current balances in `MineralAccount`, the authoritative cutover in `MineralEconomyCutover`, and idempotent `(planetId, targetLevel)` charges in `PlanetUpgradePurchase`. V2 calculations use integer micros and keep the V1 opening-balance calculation as the cutover anchor.

Legacy Prisma tables and migrations are retained only for database compatibility. No active code writes the legacy Planet, voucher, artifact, projector, or accrual paths.

## Verification map

Run the repository quality gate from the root:

```text
pnpm db:generate
pnpm db:validate
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter @megaplanets/planet-generator golden
pnpm build
```
