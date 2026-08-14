/**
 * ---
 * @customize  Framework-agnostic proxy for the Megapot Data API.
 *
 *             Exports a default Hono app that forwards the documented read-only
 *             frontend endpoints from `/api/megapot/{...path}` to
 *             `https://api.megapot.io/v1/{...path}` and injects the server-only
 *             `Authorization: Bearer ${MEGAPOT_API_KEY}` header.
 *
 *             Runtimes: any Hono-compatible host — Node (`@hono/node-server`),
 *             Bun (native), Cloudflare Workers (default export), Vercel
 *             Functions (`@hono/node-server/vercel`). See `examples/` for
 *             deploy wrappers.
 *
 *             Why this exists: keeps the browser bundle key-free. With
 *             `MEGAPOT_API_KEY` on the server and `VITE_API_BASE_URL=/api/megapot`
 *             in the client, the browser bundle never sees the key —
 *             The proxy fails closed unless a production `mpk_live_*` key is
 *             configured.
 * ---
 */
import { Hono } from 'hono';

const UPSTREAM = 'https://api.megapot.io/v1';
const ALLOWED_PATHS = [
  /^\/rounds$/,
  /^\/rounds\/active$/,
  /^\/rounds\/[^/]+$/,
  /^\/rounds\/[^/]+\/(?:tickets|wins)$/,
  /^\/wallets\/0x[0-9a-fA-F]{40}\/(?:stats|tickets|wins)$/,
  /^\/wallets\/0x[0-9a-fA-F]{40}\/(?:tickets|wins)\/rounds\/[^/]+$/,
] as const;
const proxyClients = new Map<string, { count: number; resetsAt: number }>();

function isAllowedPath(path: string): boolean {
  return ALLOWED_PATHS.some((pattern) => pattern.test(path));
}

function proxyClientId(headers: Headers): string {
  return (
    headers.get('x-vercel-forwarded-for') ??
    headers.get('x-forwarded-for') ??
    'unknown'
  ).split(',')[0].trim();
}

function allowProxyRequest(clientId: string, now = Date.now()): boolean {
  const current = proxyClients.get(clientId);
  if (!current || current.resetsAt <= now) {
    proxyClients.set(clientId, { count: 1, resetsAt: now + 60_000 });
    return true;
  }
  if (current.count >= 120) return false;
  current.count += 1;
  return true;
}

const app = new Hono();

app.all('/api/megapot/*', async (c) => {
  const incoming = new URL(c.req.url);
  const upstreamPath = incoming.pathname.replace(/^\/api\/megapot/, '');
  if (c.req.method !== 'GET') {
    return c.json({ error: 'Only read-only Megapot Data API requests are allowed.' }, 405, {
      Allow: 'GET',
    });
  }
  if (!isAllowedPath(upstreamPath)) return c.json({ error: 'Megapot Data API path not found.' }, 404);
  const upstreamUrl = `${UPSTREAM}${upstreamPath}${incoming.search}`;

  const headers = new Headers(c.req.raw.headers);
  // Strip browser-only headers that confuse upstream.
  headers.delete('host');
  headers.delete('cookie');
  headers.delete('accept-encoding');

  const apiKey = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env?.MEGAPOT_API_KEY;
  if (!apiKey?.startsWith('mpk_live_')) {
    return c.json({ error: 'Megapot Data API is not configured.' }, 503);
  }
  if (!allowProxyRequest(proxyClientId(headers))) {
    return c.json({ error: 'Megapot Data API rate limit exceeded.' }, 429, {
      'Retry-After': '60',
    });
  }
  headers.set('Authorization', `Bearer ${apiKey}`);

  const upstreamResponse = await fetch(upstreamUrl, {
    method: c.req.method,
    headers,
    body:
      c.req.method === 'GET' || c.req.method === 'HEAD' ? undefined : await c.req.raw.arrayBuffer(),
  });

  // Buffer the upstream response before returning it. Vercel's Web handler can
  // otherwise close a fetch-owned stream before the function response drains.
  // Status, headers, error envelopes, and 4xx semantics remain unchanged.
  const responseHeaders = new Headers(upstreamResponse.headers);
  const responseBody = await upstreamResponse.arrayBuffer();
  // Node fetch transparently decompresses gzip/Brotli while retaining the
  // upstream transport headers. Forwarding those headers makes Vercel decode
  // the already-decoded bytes a second time and produces an empty body.
  responseHeaders.delete('content-encoding');
  responseHeaders.delete('content-length');
  responseHeaders.delete('transfer-encoding');
  return new Response(responseBody, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders,
  });
});

export default app;
