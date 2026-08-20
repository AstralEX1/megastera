/**
 * ---
 * @customize  Framework-agnostic proxy for the Megapot Data API.
 *
 *             Exports a default Hono app that mirrors every request from
 *             `/api/megapot/{...path}` to `https://api.megapot.io/v1/{...path}`,
 *             preserving query string + method, and injects
 *             `Authorization: Bearer ${MEGAPOT_API_KEY}` if the server-side
 *             env var is set. 4xx/5xx responses are forwarded transparently
 *             with their original status code and body.
 *
 *             Runtimes: any Hono-compatible host — Node (`@hono/node-server`),
 *             Bun (native), Cloudflare Workers (default export), Vercel
 *             Functions (`@hono/node-server/vercel`). See `examples/` for
 *             deploy wrappers.
 *
 *             Why this exists: keeps the kit's bundle key-free. With
 *             `MEGAPOT_API_KEY` on the server and `VITE_API_BASE_URL=/api/megapot`
 *             in the client, the browser bundle never sees the key —
 *             unlike the `VITE_MEGAPOT_API_KEY` browser-key path.
 * ---
 */
import { Hono } from 'hono';

const UPSTREAM = 'https://api.megapot.io/v1';

const app = new Hono();

app.all('/api/megapot/*', async (c) => {
  const incoming = new URL(c.req.url);
  const upstreamPath = incoming.pathname.replace(/^\/api\/megapot/, '');
  const upstreamUrl = `${UPSTREAM}${upstreamPath}${incoming.search}`;

  const headers = new Headers(c.req.raw.headers);
  // Strip browser-only headers that confuse upstream.
  headers.delete('host');
  headers.delete('cookie');

  const apiKey = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env?.MEGAPOT_API_KEY;
  if (apiKey) {
    headers.set('Authorization', `Bearer ${apiKey}`);
  }

  const upstreamResponse = await fetch(upstreamUrl, {
    method: c.req.method,
    headers,
    body:
      c.req.method === 'GET' || c.req.method === 'HEAD' ? undefined : await c.req.raw.arrayBuffer(),
  });

  // Buffer the upstream response before returning it. Vercel's Web handler can
  // otherwise close a fetch-owned stream before the function response drains.
  // Node fetch may also transparently decode the body while retaining the
  // upstream transport headers, so forwarding those headers can make Vercel
  // decode the already-decoded bytes a second time and produce an empty body.
  const responseHeaders = new Headers(upstreamResponse.headers);
  const responseBody = await upstreamResponse.arrayBuffer();
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
