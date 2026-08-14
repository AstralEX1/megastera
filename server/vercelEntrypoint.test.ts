import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import handler, { restoreApiRequest } from '../api/index';

describe('Vercel deployment entrypoint', () => {
  it('restores the public API path after the single-function rewrite', () => {
    const request = restoreApiRequest(
      new Request('https://megastera.example/api/index?__path=planets%2Fhealth&fresh=1'),
    );

    expect(request.url).toBe('https://megastera.example/api/planets/health?fresh=1');
  });

  it('accepts the relative request URL provided by the Vercel Node runtime', () => {
    const runtimeRequest = new Request('https://megastera.example/api/index', {
      headers: { host: 'megastera.example' },
    });
    Object.defineProperty(runtimeRequest, 'url', {
      value: '/api/planets/health?__path=planets%2Fhealth&path=planets%2Fhealth&fresh=1',
    });

    const request = restoreApiRequest(runtimeRequest);

    expect(request.url).toBe('https://megastera.example/api/planets/health?fresh=1');
  });

  it('forwards the restored request to the Hono application', async () => {
    const response = await handler.fetch(
      new Request('https://megastera.example/api/index?__path=planets%2Fhealth'),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, service: 'backend-planets' });
  });

  it('keeps API routing ahead of the SPA fallback', async () => {
    const config = JSON.parse(
      await readFile(new URL('../vercel.json', import.meta.url), 'utf8'),
    ) as {
      buildCommand: string;
      functions: Record<string, unknown>;
      rewrites: Array<{ source: string; destination: string }>;
    };

    expect(config.buildCommand).toBe('pnpm vercel-build');
    expect(Object.keys(config.functions)).toEqual(['api/index.ts']);
    expect(config.rewrites).toEqual([
      { source: '/api/:path*', destination: '/api/index?__path=:path*' },
      { source: '/(.*)', destination: '/index.html' },
    ]);
  });
});
