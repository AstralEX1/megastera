# Architecture decisions

These are the active decisions for the Megastera hackathon MVP.

| ID | Decision | Reason |
| --- | --- | --- |
| D-001 | Base Sepolia only | Keeps the demo testnet-first and avoids mainnet risk. |
| D-002 | `MEGASTERA` is the Megapot source tag | Keeps attribution tied to the active Megastera application without relying on a Planet NFT deployment. |
| D-003 | Direct checkout is 1–10 tickets; 11–50 uses the keeper facilitator | Matches the existing Megapot purchase paths. |
| D-004 | A confirmed receipt is the only Planet creation authority | Prevents client-selected or stale ticket data from creating records. |
| D-005 | `originTxHash:logIndex` is the immutable generation key | Makes retries idempotent and distinguishes multiple tickets in one receipt. |
| D-006 | Planets are backend database records, not NFTs | Removes the failing contract/voucher/indexer surface from the one-day MVP. |
| D-007 | GIF bytes and hash are stored in PostgreSQL | My Planets works without Pinata, IPFS, or browser regeneration. |
| D-008 | Mining is lazy from `generatedAt` and immutable base rate | No accrual writes, transfer settlement, or background mining loop. |
| D-009 | Leaderboard is live from `BackendPlanet.generatedAt` and `baseMineralsPerDay`, cached for approximately 60 seconds | Removes daily snapshot freshness and worker/finalize runtime risk; legacy snapshot tables remain only for database compatibility. |
| D-010 | No application auth in the MVP | Wallet address is the product identity boundary; scope stays hackathon-sized. |
| D-011 | Runtime activation is environment-only | Secrets and live service configuration never enter the repository. |

Legacy NFT schemas and migrations may remain for compatibility with an existing database,
but the active code no longer reads or writes those paths.
