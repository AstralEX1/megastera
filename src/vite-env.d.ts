/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RPC_URL: string;
  /** Optional comma-separated RPC endpoints used for archive/history failover. */
  readonly VITE_RPC_FALLBACK_URLS?: string;
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string;
  /** Same-origin Megapot Data API proxy path. */
  readonly VITE_API_BASE_URL?: string;
  /** Shared base URL for backend Planet, mining, and leaderboard APIs. */
  readonly VITE_BACKEND_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
