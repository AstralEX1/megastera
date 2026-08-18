import { describe, expect, it } from 'vitest';
import handler from './api/index.js';

describe('Vercel API entrypoint', () => {
  it('handles requests through the single Vercel function', async () => {
    const candidate = handler as unknown;
    expect(typeof candidate).toBe('object');
    if (!candidate || typeof candidate !== 'object' || !('fetch' in candidate)) return;

    const response = await (candidate as { fetch: (request: Request) => Response | Promise<Response> }).fetch(
      new Request('https://megastera.test/api/planets/health'),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, service: 'backend-planets' });
  });
});
