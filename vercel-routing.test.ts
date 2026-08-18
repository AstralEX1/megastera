import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

type Rewrite = { source: string; destination: string };

const config = JSON.parse(
  readFileSync(fileURLToPath(new URL('./vercel.json', import.meta.url)), 'utf8'),
) as { rewrites?: Rewrite[] };

describe('Vercel routing', () => {
  it('forwards API subpaths to the single API function before the SPA fallback', () => {
    const rewrites = config.rewrites ?? [];
    const apiRewriteIndex = rewrites.findIndex(
      ({ source, destination }) => source === '/api/:path*' && destination === '/api',
    );
    const spaRewriteIndex = rewrites.findIndex(
      ({ source, destination }) => source === '/(.*)' && destination === '/index.html',
    );

    expect(apiRewriteIndex).toBeGreaterThanOrEqual(0);
    expect(spaRewriteIndex).toBeGreaterThan(apiRewriteIndex);
  });
});
