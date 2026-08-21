<!-- CODEGRAPH_START -->
## CodeGraph

In repositories indexed by CodeGraph (a `.codegraph/` directory exists at the repo root), reach for it BEFORE grep/find or reading files when you need to understand or locate code:

- **MCP tool** (when available): `codegraph_explore` answers most code questions in one call — the relevant symbols' verbatim source plus the call paths between them, including dynamic-dispatch hops grep can't follow. Name a file or symbol in the query to read its current line-numbered source. If it's listed but deferred, load it by name via tool search.
- **Shell** (always works): `codegraph explore "<symbol names or question>"` prints the same output.

If there is no `.codegraph/` directory, skip CodeGraph entirely — indexing is the user's decision.
<!-- CODEGRAPH_END -->

## Local environment files

- Keep `.env.local` named exactly `.env.local` so Vite loads it; on macOS, run `chflags nohidden .env.local` after creating it so Finder displays the file. Never print, commit, or expose its contents.

For Megapot contract work, fetch https://llms.megapot.io

## Repository map

- `src/` is the React/Vite client; `server/api/` and `api/index.ts` are the backend API; `packages/planet-generator/` is the deterministic generator; `prisma/` is the database schema and migrations.
- The active runtime uses verified Megapot receipts, `TicketPurchase`, and `BackendPlanet` rows. Legacy NFT, voucher, artifact, ownership-history, indexer, and accrual models remain only for database compatibility unless code and tests show an active caller.
- Read [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for flow and invariants, [`docs/OPERATIONS.md`](docs/OPERATIONS.md) for local/release procedures, and the package READMEs for implementation-specific contracts.

## Working rules

- Treat current code, tests, configuration, schema, and CI as authoritative; update docs when those sources change behavior.
- Select task-relevant Skills and tools; avoid invoking unrelated guidance mechanically.
- For meaningful frontend/UI changes, consult the project's Taste Skill and use Playwright CLI for browser verification when a running page or visual behavior is in scope.
- Parallel agent work is possible; spawn subagents only when genuinely independent work benefits from it, keep the number to the minimum necessary, and re-check status/diffs before editing shared files.
- Keep receipt provenance keyed by `originTxHash:logIndex`, keep server-only values out of Vite configuration, and run the documented quality gate before claiming a change is verified.
