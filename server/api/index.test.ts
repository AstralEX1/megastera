import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from './index.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('active API surface', () => {
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

  it('forwards the configured Megapot API path used by the production bundle', async () => {
    const upstreamResponse = { id: '148', status: 'active' };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(upstreamResponse), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const response = await createApp().request('/api/megapot/rounds/active');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(upstreamResponse);
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.megapot.io/v1/rounds/active',
      expect.objectContaining({ method: 'GET', body: undefined }),
    );
  });
});
