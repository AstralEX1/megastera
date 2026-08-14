# Megastera status

Updated: 2026-08-14

## Mainnet preparation

The repository runtime is configured for Base mainnet only:

- canonical mainnet Megapot, batch facilitator, payout calculator, and USDC addresses;
- approved Megastera referrer and unchanged `MEGASTERA` source;
- mainnet-only receipt verification and BaseScan links;
- production Megapot Data API through a server-only same-origin proxy;
- a single Vercel project for the Vite SPA and Hono Function;
- Supabase transaction-pooler runtime configuration, direct migration URL, and API-role
  lockdown migration.

Preview and Development Vercel environments are also mainnet-only. They must use separate
or deliberately selected credentials, but must not restore Base Sepolia constants.

## Active product

A finalized, receipt-verified ticket is persisted in PostgreSQL and deterministically
produces one backend Planet plus a stored GIF. My Planets includes generated and retryable
pending site tickets. Mining remains read-only from `generatedAt`; the leaderboard remains
a live backend read with its existing short process cache.

## External actions still required

- Create the new Supabase mainnet project and run `pnpm db:deploy` against its `DIRECT_URL`.
- Add the documented Production/Preview/Development environment variables in Vercel.
- Link/import the repository into one Vercel project and deploy it.
- Run post-deploy health, Data API proxy, database, and browser checks.
- Perform a funded mainnet purchase/claim smoke test only with explicit transaction approval.

No database or Vercel deployment and no funded wallet transaction is claimed by the
checked-in preparation alone.
