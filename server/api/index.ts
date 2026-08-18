import { Hono } from 'hono';
import { createCorsMiddleware } from './cors';
import {
  createBackendPlanetRoutes,
  type BackendPlanetRouteDependencies,
} from './backendPlanetRoutes';
import { createLeaderboardRoutes } from './leaderboardRoutes';
import { createOperationalState } from './operations';

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
  app.route('/api', createBackendPlanetRoutes(backendPlanetOverrides));
  app.route('/api/leaderboard', createLeaderboardRoutes());

  return app;
}

export default createApp();
