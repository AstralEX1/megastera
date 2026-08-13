# Megastera repository guidance

## Working language

- Write source code, identifiers, filenames, commit messages, tests, and technical
  documentation in English.
- User-facing copy may be localized later, but English is the source language.

## Workflow

- Work only on the explicitly requested stage and stop after reporting its result.
- Preserve user changes and keep unrelated edits out of the current stage.
- Use pnpm. Do not introduce another JavaScript package manager.
- Never commit secrets. Use `.env.local`, host environment variables, or placeholders.
- Before changing code, read `README.md`, the relevant section of
  `docs/ARCHITECTURE.md`, then `docs/STATUS.md` and `docs/OPERATIONS.md` when
  deployment or runtime configuration is involved.

## Megapot integration rules

- Read `.agents/skills/megapot/SKILL.md` before changing Megapot contract calls,
  addresses, event decoding, drawing lifecycle behavior, or Data API usage.
- Treat `https://llms.megapot.io/` as the protocol source of truth.
- Target Base Sepolia until a later stage explicitly authorizes mainnet work.
- Read ticket price, drawing ID, ball limits, fees, and lifecycle state dynamically.
- Keep `TICKET_SOURCE` equal to `MEGASTERA`.
- Never deploy with the dead referrer address.
- Compare allowance with the exact required amount before every purchase. When
  insufficient, approve the route-specific spender with `maxUint256`, then refetch
  or invalidate allowance after a successful receipt.

## Backend Planet MVP invariants

- A confirmed Megapot receipt is the source of truth for a purchase; persist the
  immutable `MegasteraProof` and `TicketPurchase` before generating a planet.
- A generated `BackendPlanet` is keyed idempotently by `TicketPurchase`, stores its
  deterministic traits and GIF in the database, and is displayed from the backend.
- Mining is read-only and calculated from immutable backend generation time and the
  persisted base rate. Leaderboard snapshots remain daily UTC snapshots.
- The active runtime has no Planet contract, NFT mint/reveal, voucher signer,
  Pinata upload, direct wallet holdings, continuous ticket indexer, or Transfer/
  PlanetMinted projector.
- Legacy Prisma tables and migrations may remain only for database compatibility;
  they must not be imported by the active API or frontend.
- No application auth or user-provided wallet ownership claim is introduced in
  this MVP. Wallet address is the existing product identity boundary.

## Code conventions and verification

- Follow existing TypeScript, React, wagmi, viem, TanStack Query, Tailwind, and
  Biome patterns from this repository.
- Keep bigint values as bigint until display formatting.
- Add or update tests for meaningful behavior changes.
- Keep shared deterministic generation logic free of browser-only global state.
- Prefer explicit errors over silent fallbacks.

From the repository root run the full gate before claiming completion:

`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm db:generate`,
`pnpm db:validate`, and `pnpm --filter @megaplanets/planet-generator golden`.

Record any blocked live RPC, database, browser, deployment, or funded-wallet check
separately; local build/test success is not a production verification claim.
