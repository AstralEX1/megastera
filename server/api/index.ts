import { Hono } from 'hono';
import { createCorsMiddleware } from './cors.js';
import {
  createBackendPlanetRoutes,
  type BackendPlanetRouteDependencies,
} from './backendPlanetRoutes.js';
import { createLeaderboardRoutes } from './leaderboardRoutes.js';
import { reportBackendError } from './errorDiagnostics.js';
import { runLeaderboardFinalization } from './leaderboardWorker.js';
import { createOperationalState } from './operations.js';
import megapotProxy from '../proxy.js';

/**
 * The active API surface is deliberately small for the hackathon MVP:
 * receipt verification and backend Planet generation, mining, and leaderboard
 * reads. Planet NFT vouchers, contract holdings, and continuous indexers are
 * not mounted here.
 */
export function createApp(
  backendPlanetOverrides: Partial<BackendPlanetRouteDependencies> = {},
) {
  const operations = createOperationalState();
  const app = new Hono();

  app.use('*', createCorsMiddleware());
  app.use('*', async (c, next) => {
    await next();
    operations.recordHttpRequest(c.res.status);
    return c.res;
  });

  app.get('/api/planets/health', (c) => c.json({ ok: true, service: 'backend-planets' }));
  app.get('/api/planets/metrics', (c) =>
    c.json({ ok: true, service: 'api', operations: operations.snapshot() }),
  );
  app.get('/api/internal/leaderboard-worker', async (c) => {
    const cronSecret = process.env.CRON_SECRET?.trim();
    if (!cronSecret || c.req.header('authorization') !== `Bearer ${cronSecret}`) {
      return c.json({ error: 'Unauthorized.' }, 401);
    }
    try {
      await runLeaderboardFinalization();
      return c.json({ ok: true });
    } catch (error) {
      return c.json(
        { error: 'Leaderboard worker failed.' },
        500,
        reportBackendError('GET /api/internal/leaderboard-worker', error),
      );
    }
  });
  app.route('/', megapotProxy);
  app.route('/api', createBackendPlanetRoutes(backendPlanetOverrides));
  app.route('/api/leaderboard', createLeaderboardRoutes());

  return app;
}

export default createApp();
