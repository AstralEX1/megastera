import { describe, expect, it } from 'vitest';
import { loadBackendPlanetConfig } from './backendConfig';

describe('backend mainnet configuration', () => {
  it('loads Base mainnet RPC endpoints and the Supabase runtime URL', () => {
    expect(
      loadBackendPlanetConfig({
        BASE_RPC_URL: 'https://mainnet.base.org',
        BASE_RPC_FALLBACK_URLS:
          'https://base-rpc.publicnode.com, https://mainnet.base.org, https://fallback.example',
        DATABASE_URL:
          'postgresql://prisma.project:password@region.pooler.supabase.com:6543/postgres?pgbouncer=true',
        MEGAPLANETS_CONFIRMATIONS: '8',
      }),
    ).toEqual({
      chainId: 8453,
      rpcUrl: 'https://mainnet.base.org',
      rpcFallbackUrls: ['https://base-rpc.publicnode.com', 'https://fallback.example'],
      databaseUrl:
        'postgresql://prisma.project:password@region.pooler.supabase.com:6543/postgres?pgbouncer=true',
      confirmations: 8n,
    });
  });

  it('does not accept the retired Base Sepolia environment variable', () => {
    expect(() =>
      loadBackendPlanetConfig({
        BASE_SEPOLIA_RPC_URL: 'https://sepolia.base.org',
        DATABASE_URL: 'postgresql://example',
      }),
    ).toThrow('Missing required server environment variable BASE_RPC_URL.');
  });
});
