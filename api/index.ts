import app from '../server/api/index.js';

const REWRITE_PARAMETER = '__path';

/** Restores the public path encoded by the catch-all rewrite in vercel.json. */
export function restoreApiRequest(request: Request): Request {
  const host = request.headers.get('host') ?? 'localhost';
  const url = new URL(request.url, `https://${host}`);
  const rewrittenPath = url.searchParams.get(REWRITE_PARAMETER);
  if (rewrittenPath === null) return request;

  url.searchParams.delete(REWRITE_PARAMETER);
  url.searchParams.delete('path');
  const safePath = rewrittenPath.replace(/^\/+/, '');
  url.pathname = safePath ? `/api/${safePath}` : '/api';
  return new Request(url, request);
}

export function handleRequest(request: Request): Response | Promise<Response> {
  return app.fetch(restoreApiRequest(request));
}

/** Opts into Vercel's Web-standard Request/Response function interface. */
export default { fetch: handleRequest };
