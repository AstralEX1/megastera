import { describe, expect, it } from 'vitest';
import { createApp } from './index.js';

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
});
