# Architecture decisions

| ID | Decision | Reason |
| --- | --- | --- |
| D-001 | Base mainnet only in all runtime environments | Prevents preview or local configuration from silently targeting a different protocol deployment. |
| D-002 | `MEGASTERA` remains the Megapot source tag | Preserves attribution and receipt eligibility. |
| D-003 | Direct checkout is 1–10; 11–50 uses the batch facilitator | Matches canonical Megapot purchase paths. |
| D-004 | A finalized canonical receipt is the only Planet creation authority | Prevents client-selected or stale ticket data from creating records. |
| D-005 | No mainnet launch-block cutoff | Accepts every canonical mainnet Megastera receipt with the simplest provenance policy. |
| D-006 | `originTxHash:logIndex` is the immutable generation key | Makes retries idempotent and distinguishes events in one receipt. |
| D-007 | Planets are backend database records, not NFTs | Keeps the active MVP independent of a Planet contract, signer, IPFS, and projector. |
| D-008 | One Vercel project hosts SPA, Hono API, and Data API proxy | Provides one origin and keeps the Megapot API key server-only. |
| D-009 | A new Supabase project is the mainnet database | Separates production provenance from prior test data. |
| D-010 | Prisma runtime uses one pooled connection per function instance | Limits serverless connection pressure. |
| D-011 | GIF bytes and hash are stored in PostgreSQL | My Planets does not regenerate authoritative media in the browser. |
| D-012 | Mining is lazy and the leaderboard is live with a short cache | Avoids accrual writes and required background workers. |
| D-013 | No application auth | Wallet address remains the existing product identity boundary. |

Legacy schemas and historical plans may remain for compatibility or audit context, but
they do not define the active runtime.
