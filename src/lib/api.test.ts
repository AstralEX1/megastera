import { describe, expect, it, vi } from 'vitest';
import { getApiBaseUrlEnvironmentMismatch, resolveApiBaseUrl } from './api';

describe('Megapot Data API network selection', () => {
  it('defaults Base Sepolia reads to the testnet host', () => {
    expect(resolveApiBaseUrl('testnet')).toBe('https://api-testnet.megapot.io/v1');
  });

  it('fails closed when a Base Mainnet host is configured for testnet', () => {
    expect(resolveApiBaseUrl('testnet', 'https://api.megapot.io/v1')).toBe('https://api-testnet.megapot.io/v1');
    expect(getApiBaseUrlEnvironmentMismatch('testnet', 'https://api.megapot.io/v1')).toMatch(/Base Mainnet/);
  });

  it('keeps same-origin proxies available for environment-specific routing', () => {
    expect(resolveApiBaseUrl('testnet', '/api/megapot')).toBe('/api/megapot');
    expect(getApiBaseUrlEnvironmentMismatch('testnet', '/api/megapot')).toBeUndefined();
  });

  it('fetches through a relative same-origin proxy URL in the browser', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_API_BASE_URL', '/api/megapot');
    const { api } = await import('./api');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: [], next_cursor: null, has_more: false }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    let requestedUrl: string | undefined;
    try {
      await api.walletTickets('0x0000000000000000000000000000000000000001', { limit: 100 });
      expect(fetchMock).toHaveBeenCalledOnce();
      requestedUrl = String(fetchMock.mock.calls[0]?.[0]);
    } finally {
      fetchMock.mockRestore();
      vi.unstubAllEnvs();
    }

    expect(requestedUrl).toBe(
      'http://localhost/api/megapot/wallets/0x0000000000000000000000000000000000000001/tickets?limit=100',
    );
  });
});
