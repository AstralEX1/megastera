# Megastera status

Updated: 2026-08-13

## Active product

Megastera is a Base Sepolia MVP. Users buy Megapot tickets with the `MEGASTERA`
source tag; no Planet NFT is minted. A finalized, receipt-verified ticket is persisted
in PostgreSQL and deterministically produces one backend Planet plus an immutable GIF
artifact.

## Current user flow

- Play has two stages: Buy tickets and Explore planets.
- After the receipt is recovered, Play shows `Exploring planets…` and retries backend
  generation while the receipt reaches the configured confirmation depth.
- A successful generation fills the screen with Planet cards and the only next actions are
  `Explore again` and `My planets`.
- My Planets reads the backend collection and shows every site ticket as a generated Planet
  or a pending card with retry. Locally confirmed site receipts remain visible before the
  backend catch-up completes.
- Unmatched wallet tickets may appear as plain ticket cards from the paginated Megapot
  Data API.
- Ticket status/winnings/claimed data uses the Base Sepolia Data API. Live drawing state,
  purchases, and claims use RPC/on-chain writes.
- Mining remains a read-only calculation from backend Planet `generatedAt` and the base
  rate. Leaderboard remains a live backend read with its existing cache behavior.

## Backend surface

- `POST /api/planets/generate` and `/api/planets/generate/batch`
- `GET /api/planets/collection?owner=...`
- `GET /api/planets?owner=...`
- Planet GIF/detail/mining routes
- Wallet mining and leaderboard routes

The collection query is limited to Base Sepolia, the configured jackpot, and `MEGASTERA`.
It does not discover or import legacy `MEGAPLANETS_V1` tickets.

## Verification checkpoint

The focused Play, My Planets, success-screen, collection-merge, and Data API host tests
pass. The complete repository gate also passes: lint, typecheck, all tests, production
build, Prisma generation/validation, and the planet-generator golden suite. The local
runtime smoke check returns `health=200`, `collection=200`, generated Planet rows, and
GIF bytes with `image/gif` content type.

Required gate:

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm db:generate
pnpm db:validate
pnpm --filter @megaplanets/planet-generator golden
```

Live generation additionally requires `DATABASE_URL`, a Base Sepolia RPC URL, and a
funded test wallet. The browser can verify public Data API reads without exposing server
secrets. The local dev runtime loads these values from the ignored `.env.local` file.
