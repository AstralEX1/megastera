import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, getApiBaseUrlEnvironmentMismatch, resolveApiBaseUrl } from './api';

describe('Megapot Data API network selection', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('defaults reads to the same-origin mainnet proxy', () => {
    expect(resolveApiBaseUrl()).toBe('/api/megapot');
  });

  it('fails closed when the Base Sepolia host is configured', () => {
    expect(resolveApiBaseUrl('https://api-testnet.megapot.io/v1')).toBe(
      '/api/megapot',
    );
    expect(
      getApiBaseUrlEnvironmentMismatch('https://api-testnet.megapot.io/v1'),
    ).toMatch(/Base Sepolia/);
  });

  it('keeps the same-origin production proxy available', () => {
    expect(resolveApiBaseUrl('/api/megapot')).toBe('/api/megapot');
    expect(getApiBaseUrlEnvironmentMismatch('/api/megapot')).toBeUndefined();
  });

  it('does not allow the browser to bypass the server-only API key boundary', () => {
    expect(resolveApiBaseUrl('https://api.megapot.io/v1')).toBe('/api/megapot');
    expect(getApiBaseUrlEnvironmentMismatch('https://api.megapot.io/v1')).toMatch(
      /same-origin proxy/,
    );
  });

  it('calls the relative same-origin proxy without requiring an absolute URL', async () => {
    const request = vi.fn(async () =>
      Response.json({ data: [], next_cursor: null, has_more: false }),
    );
    vi.stubGlobal('fetch', request);

    await api.listRounds({ limit: 1 });

    expect(request).toHaveBeenCalledWith(
      '/api/megapot/rounds?limit=1',
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    );
  });
});
