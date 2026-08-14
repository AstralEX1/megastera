import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from './index';

describe('active API surface', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.MEGAPOT_API_KEY;
  });
  it('exposes backend Planet health and metrics', async () => {
    const app = createApp();
    expect((await app.request('/api/planets/health')).status).toBe(200);
    expect((await app.request('/api/planets/metrics')).status).toBe(200);
  });

  it('does not expose the retired NFT voucher or readiness routes', async () => {
    const app = createApp();
    expect((await app.request('/api/planets/vouchers')).status).toBe(404);
    expect((await app.request('/api/planets/readiness')).status).toBe(404);
  });

  it('proxies the mainnet Megapot Data API with the server-only key', async () => {
    process.env.MEGAPOT_API_KEY = 'mpk_live_example';
    const upstream = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      expect(input.toString()).toBe('https://api.megapot.io/v1/rounds?limit=1');
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer mpk_live_example');
      return new Response(JSON.stringify({ data: [] }), {
        headers: {
          'content-type': 'application/json',
          'content-encoding': 'br',
          'content-length': '8',
        },
      });
    });
    vi.stubGlobal('fetch', upstream);

    const response = await createApp().request('/api/megapot/rounds?limit=1');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-encoding')).toBeNull();
    expect(response.headers.get('content-length')).toBeNull();
    expect(await response.json()).toEqual({ data: [] });
    expect(upstream).toHaveBeenCalledOnce();
  });

  it('fails closed when the production Data API key is missing', async () => {
    const upstream = vi.fn();
    vi.stubGlobal('fetch', upstream);

    const response = await createApp().request('/api/megapot/rounds?limit=1');

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'Megapot Data API is not configured.' });
    expect(upstream).not.toHaveBeenCalled();
  });

  it('does not relay writes or arbitrary paths with the privileged key', async () => {
    process.env.MEGAPOT_API_KEY = 'mpk_live_example';
    const upstream = vi.fn();
    vi.stubGlobal('fetch', upstream);

    const write = await createApp().request('/api/megapot/rounds', { method: 'POST' });
    const arbitrary = await createApp().request('/api/megapot/admin/secrets');

    expect(write.status).toBe(405);
    expect(write.headers.get('allow')).toBe('GET');
    expect(arbitrary.status).toBe(404);
    expect(upstream).not.toHaveBeenCalled();
  });
});
