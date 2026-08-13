# Megastera

Megastera is a one-day hackathon MVP built around Megapot tickets on Base Sepolia.
Planets are deliberately backend records, not on-chain NFTs: a confirmed ticket receipt
creates one database row, the server renders a deterministic GIF, and My Planets displays
that row. Mining remains a read-only lifetime calculation.

## The demo loop

```mermaid
flowchart LR
  A["Buy 1–10 tickets"] --> B["Confirmed TicketPurchased receipt"]
  A2["Create 11–50 bulk order"] --> A3["Keeper execution"] --> B
  B --> C["Persist MEGASTERA ticket proof"]
  C --> D["Generate GIF + BackendPlanet"]
  D --> E["My Planets collection"]
  C --> P["Pending row / retry"]
  P --> D
  C --> F["Lazy mining from generatedAt"]
  F --> G["Live leaderboard · 60s cache"]
```

1. Connect a wallet to Base Sepolia.
2. Buy one to ten direct tickets or create an eleven-to-fifty keeper order.
3. After the receipt is confirmed, the Play screen shows `Exploring planets…` and retries
   backend generation while the receipt reaches the configured finality depth.
4. The backend verifies the canonical `MEGASTERA` `TicketPurchased` event, persists
   immutable ticket provenance before generation, derives deterministic traits, and stores
   GIF bytes. Repeating the same request is idempotent.
5. My Planets reads the backend collection: ready Planets, compact retryable pending cards,
   and optionally unmatched wallet tickets from the paginated testnet Data API. The same
   ready rows power lazy mining and the live leaderboard; `/tickets` exposes protocol
   status and claimable wins.

There is no Planet contract call, mint button, voucher, Pinata/IPFS artifact, direct
ERC721A holdings read, or continuous indexer in the active MVP.

## Product rules

- Base Sepolia (`chainId 84532`) only.
- `MEGASTERA` is the Megapot source tag.
- Direct checkout supports one to ten tickets; bulk checkout supports eleven to fifty.
- Backend generation is idempotent on `originTxHash:logIndex` and rejects conflicting
  persisted provenance.
- The collection API is restricted to Base Sepolia `MEGASTERA` ticket proofs; legacy
  `MEGAPLANETS_V1` rows are not eligible.
- Historical ticket status, winnings, and claimed state come from the Megapot testnet
  Data API (`https://api-testnet.megapot.io/v1`). Live drawing state and writes remain
  on RPC.
- Planet traits use the shared deterministic generator. GIF bytes and their hash are stored
  in `BackendPlanet`.
- Mining is `baseMineralsPerDay × elapsed time` with fixed-point integer arithmetic. The
  browser never writes mineral state.
- Public reads require no application auth; server secrets stay outside Vite env variables.

## Runtime boundaries

| Boundary | Responsibility |
| --- | --- |
| Megapot + Base RPC | Ticket purchase, receipt finality, and canonical event verification |
| Frontend | Wallet checkout, generation progress, backend collection, mining display |
| API + PostgreSQL | Ticket provenance, BackendPlanet rows, GIF bytes, mining, leaderboard |
| Planet generator | DOM-free deterministic traits and server/browser rendering support |

## API

See [`api/README.md`](api/README.md) for the full route surface. The important paths are:

- `POST /api/planets/generate` and `/generate/batch`
- `GET /api/planets/collection?owner=...` (ready and pending site tickets)
- `GET /api/planets?owner=...` and `/planets/:planetId/gif`
- `GET /api/wallets/:address/mining`
- `GET /api/leaderboard/current`

## Local development

Requirements: Node.js 22+, pnpm, and a Base Sepolia RPC URL for live receipt reads.

```bash
pnpm install
pnpm db:generate
pnpm db:validate
pnpm dev
pnpm api:server
```

Backend generation requires `BASE_SEPOLIA_RPC_URL` and `DATABASE_URL`; optional RPC
failover uses `BASE_SEPOLIA_RPC_FALLBACK_URLS`. Keep `.env.local` and server secrets out
of git.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm db:generate
pnpm db:validate
pnpm --filter @megaplanets/planet-generator golden
```
