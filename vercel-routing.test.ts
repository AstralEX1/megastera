import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

type Route = { src?: string; dest?: string; handle?: string };

const config = JSON.parse(
  readFileSync(fileURLToPath(new URL('./vercel.json', import.meta.url)), 'utf8'),
) as { routes?: Route[] };

describe('Vercel routing', () => {
  it('routes API requests to the single function before static files and the SPA fallback', () => {
    const routes = config.routes ?? [];
    const apiRouteIndex = routes.findIndex(
      ({ src, dest }) => src === '/api(?:/.*)?' && dest === '/api/index.ts',
    );
    const filesystemRouteIndex = routes.findIndex(({ handle }) => handle === 'filesystem');
    const spaFallbackIndex = routes.findIndex(
      ({ src, dest }) => src === '/.*' && dest === '/index.html',
    );

    expect(apiRouteIndex).toBeGreaterThanOrEqual(0);
    expect(filesystemRouteIndex).toBeGreaterThan(apiRouteIndex);
    expect(spaFallbackIndex).toBeGreaterThan(filesystemRouteIndex);
  });
});
