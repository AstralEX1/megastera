# Megastera Backend Planets Design

## Goal

Move Planet ownership and media generation off-chain for the hackathon MVP while preserving Megapot purchases, receipt provenance, claims, mining, and leaderboard reads.

## Decisions

- A confirmed Base Sepolia `TicketPurchased` receipt with source `MEGASTERA` is the only creation authority.
- The backend creates one Planet per receipt event, keyed idempotently by `originTxHash:logIndex` and assigned to the event recipient.
- Planet traits remain deterministic and are derived by the existing shared generator from the canonical ticket proof.
- The backend renders the existing 128x128 GIF renderer and stores the GIF bytes in PostgreSQL; the API serves the bytes to My Planets.
- Mining starts at backend Planet creation time and continues to use the existing immutable base-rate/lifetime formula. No accrual ledger or transfer settlement is introduced.
- My Planets reads backend Planet rows only. There is no on-chain Planet mint, voucher, Pinata/IPFS artifact, direct ERC721A holdings read, or Planet event projector in the active runtime.
- Existing Megapot claim and ticket-history functionality remains on-chain and receipt/Data-API driven.

## Runtime flow

```text
Megapot buy → confirmed TicketPurchased receipt → POST /api/planets/generate
→ proof persisted → deterministic traits + GIF persisted → GET /api/planets?owner
→ My Planets renders GIF → mining/leaderboard read the same backend Planet row
```

Generation is synchronous for the MVP so no worker or queue is required. Requests are safe to retry: an existing ready row is returned, and a failed generation can be retried using the same receipt key.

## API and persistence

- Keep the server-side receipt verifier and `TicketPurchase` proof persistence.
- Add a backend Planet persistence model with ticket relation, recipient, deterministic traits, base rate, generation timestamps/status, and GIF bytes/hash.
- Add `POST /api/planets/generate` accepting only `{ transactionHash, logIndex, recipient? }`; the server re-fetches and validates the receipt.
- Add `GET /api/planets?owner=<address>` and `GET /api/planets/:planetId/gif` for the inventory.
- Keep wallet/planet mining and live leaderboard routes, switching their source to backend Planet rows and a short backend cache.
- Remove Planet voucher routes and their signer/Pinata/NFT readiness requirements.

## Frontend

- Keep direct and keeper Megapot purchase UX, canonical receipt decoding, local receipt recovery, ticket status, claims, and mining/leaderboard views.
- After a successful receipt, call backend generation for each decoded event (or a bounded batch wrapper), then invalidate backend Planet queries.
- Replace Play/My Planets NFT reveal/mint/holdings/indexer data with backend Planet queries and server GIF URLs.
- Remove manual mint buttons, voucher handling, contract ownership reads, and browser GIF generation for inventory entries.

## Verification

- Unit tests cover receipt validation, generation idempotency, conflict handling, GIF persistence/HTTP response, API errors, and mining from backend rows.
- Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm db:generate`, and `pnpm db:validate`.
- No live transaction, deployment, database migration against production, or secret handling is part of this change.
