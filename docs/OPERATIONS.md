# Mainnet operations and deployment

This runbook deploys the Base mainnet Vite frontend, Hono backend, and Megapot Data API
proxy as one Vercel project backed by a new Supabase PostgreSQL project. It does not require
a Planet contract, signer, private key, Pinata, or continuous indexer.

## Dependency matrix

| Dependency | Mainnet value | Visibility |
| --- | --- | --- |
| Chain | Base `8453` | checked-in |
| Jackpot | `0x3bAe643002069dBCbcd62B1A4eb4C4A397d042a2` | checked-in |
| Batch facilitator | `0xBA343479D98a1Ed333899999D95a7343B808a76F` | checked-in |
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | checked-in |
| Payout calculator | `0x97a22361b6208aC8cd9afaea09D20feC47046CBD` | checked-in |
| Referrer | `0x43904de0e226cc20DD72968954af6B439404743D` | checked-in |
| Source | `MEGASTERA` padded to bytes32 | checked-in |
| Data API | `https://api.megapot.io/v1` via `/api/megapot` | checked-in host, secret key |
| Browser RPC | `VITE_RPC_URL` + optional fallbacks | public env |
| Receipt RPC | `BASE_RPC_URL` + optional fallbacks | server env |
| Database runtime | Supabase transaction pooler | server secret |
| Database migrations | Supabase direct/session URL | operator secret |

## 1. Create the new Supabase project

Choose a Supabase region close to the intended Vercel Function region. Do not reuse or
copy testnet rows into the new database.

Collect two connection strings from Supabase:

- `DATABASE_URL`: transaction pooler, port `6543`, with
  `pgbouncer=true&sslmode=require&uselibpqcompat=true`; used by Vercel runtime. The runtime
  also adds `uselibpqcompat=true` when an older saved URL contains only `sslmode=require`.
- `DIRECT_URL`: direct connection or session pooler, normally port `5432`, with
  `sslmode=require`; used only by Prisma migration commands.

Keep both URLs out of git. From a trusted operator environment, set them temporarily and
apply the full migration history:

```bash
pnpm db:generate
pnpm db:validate
pnpm db:deploy
```

The final migration revokes table, sequence, and function access from Supabase `anon` and
`authenticated` roles. The application does not use Supabase browser keys; all database
access is server-side. Confirm that `ticket_purchases` and `backend_planets` exist and are
empty before launch.

## 2. Configure one Vercel project

Import the repository as a Vite project. Keep the repository root as the project root.
`vercel.json` generates Prisma Client, builds the app, selects the static output directory,
one API Function, API
catch-all rewrite, and SPA fallback.

Set these variables for Production. Preview and Development are also mainnet-only; use
appropriate isolated credentials without changing the chain.

```text
# Public browser values
VITE_RPC_URL=<dedicated Base mainnet HTTPS RPC>
VITE_RPC_FALLBACK_URLS=<optional comma-separated Base mainnet HTTPS RPCs>
VITE_WALLETCONNECT_PROJECT_ID=<public WalletConnect project ID>
VITE_API_BASE_URL=/api/megapot
VITE_BACKEND_API_BASE_URL=

# Server-only values
BASE_RPC_URL=<dedicated Base mainnet HTTPS RPC>
BASE_RPC_FALLBACK_URLS=<optional comma-separated Base mainnet HTTPS RPCs>
DATABASE_URL=<Supabase transaction pooler URL>
MEGAPOT_API_KEY=<mpk_live_* key>
MEGAPLANETS_CONFIRMATIONS=6
```

Do not add `DIRECT_URL` to Vercel unless migrations will deliberately run there. Never add
`DATABASE_URL`, RPC provider secrets, or `MEGAPOT_API_KEY` with a `VITE_*` prefix. The
referrer, contracts, chain, and Data API host are deliberately checked-in mainnet constants.

For a same-origin deployment, leave `MEGAPLANETS_ALLOWED_ORIGINS` unset. If an external
frontend is introduced later, set an exact comma-separated HTTPS origin allowlist.

Before promotion, add Vercel Firewall rate-limit rules for `/api/megapot/*` and the two
`POST /api/planets/generate*` paths. The application also applies per-instance client
limits and charges batch generation by receipt count, but serverless instances do not
provide a deployment-wide quota by themselves. The proxy accepts only the documented
read-only `GET` paths and never relays arbitrary methods or upstream routes.

## 3. Pre-deploy gate

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm db:generate
pnpm db:validate
pnpm --filter @megaplanets/planet-generator golden
```

Run `pnpm db:deploy` separately against the new Supabase project before promoting the
application. Migrations are intentionally not part of the Vercel build to avoid concurrent
Preview and Production migration attempts.

## 4. Post-deploy checks

Perform read-only checks first:

1. Load `/` and confirm the wallet requests Base chain ID `8453`.
2. `GET /api/planets/health` returns JSON with status `200`.
3. `GET /api/planets/metrics` returns JSON rather than the SPA document.
4. `GET /api/megapot/rounds?limit=1` returns the production Data API response.
5. `GET /api/planets/collection?owner=<checksummed-wallet>` reaches Supabase and returns
   an empty collection or existing mainnet rows.
6. Check Vercel Function logs for RPC, database, proxy, CORS, or timeout errors.
7. Confirm no `mpk_live_*`, database password, or provider credential appears in browser
   source, network request headers, or build output.

Only after these pass should a separately approved funded-wallet smoke test buy a minimal
ticket quantity, wait for configured confirmations, generate its Planet, verify its GIF,
and optionally test claiming. A successful local build is not evidence of a live purchase.

## Runtime notes

- Each warm function instance limits Prisma to one pooled PostgreSQL connection.
- Health does not query the database; use a collection request for database verification.
- HTTP metrics, leaderboard cache, and application rate limiting are process-local in
  serverless. Vercel Firewall is the deployment-wide abuse-control boundary.
- Generation persists the ticket proof before rendering. A storage/render failure leaves a
  retryable pending row; do not delete production provenance to clear it.
- Receipt verification checks Base mainnet, status, confirmations, canonical block hash,
  Jackpot address, `MEGASTERA`, event fields, and optional recipient.
- The Data API is historical/read-only; live drawing state and all transactions use RPC.

## Rollback

Roll back the Vercel deployment without rolling back immutable database provenance. Do not
reverse or delete applied production migrations. If a mainnet configuration is wrong, stop
promotion, correct environment values or code, rerun the gate, and deploy a new version.
