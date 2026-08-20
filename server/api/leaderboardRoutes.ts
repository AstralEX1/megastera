import { Hono } from 'hono';
import { getAddress, isAddress } from 'viem';
import { z } from 'zod';
import { getPrismaClient } from './database.js';
import type { PrismaClient } from './generated/prisma/client.js';
import {
  getCurrentLeaderboard,
  getWalletLeaderboardPosition,
} from './leaderboardStore.js';
import { loadBackendPlanetConfig, loadMineralEconomyConfig } from './backendConfig.js';
import { reportBackendError } from './errorDiagnostics.js';

const paginationSchema = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

type LeaderboardDependencies = {
  getPrisma: () => PrismaClient;
  now: () => Date;
  getCurrent: typeof getCurrentLeaderboard;
  getWalletPosition: typeof getWalletLeaderboardPosition;
};

const defaultDependencies: LeaderboardDependencies = {
  getPrisma: () => getPrismaClient(loadBackendPlanetConfig(process.env).databaseUrl),
  now: () => new Date(),
  getCurrent: (prisma, now, pagination) =>
    getCurrentLeaderboard(prisma, now, pagination, loadMineralEconomyConfig(process.env)),
  getWalletPosition: (prisma, walletAddress, now) =>
    getWalletLeaderboardPosition(
      prisma,
      walletAddress,
      now,
      loadMineralEconomyConfig(process.env),
    ),
};

function parsePagination(query: (name: string) => string | undefined) {
  return paginationSchema.safeParse({ offset: query('offset') ?? 0, limit: query('limit') ?? 50 });
}

function serializePeriod(period: {
  id: string;
  startsAt: Date;
  endsAt: Date;
  finalizedAt?: Date | null;
}) {
  return {
    id: period.id,
    startsAt: period.startsAt.toISOString(),
    endsAt: period.endsAt.toISOString(),
    ...(period.finalizedAt === undefined
      ? {}
      : { finalizedAt: period.finalizedAt?.toISOString() ?? null }),
  };
}

function serializeRow(row: {
  rank: number;
  walletAddress: string;
  scoreMicros: bigint;
  effectiveMineralsPerDayMicros: bigint;
}) {
  return {
    rank: row.rank,
    walletAddress: row.walletAddress,
    scoreMicros: row.scoreMicros.toString(),
    effectiveMineralsPerDayMicros: row.effectiveMineralsPerDayMicros.toString(),
  };
}

export function createLeaderboardRoutes(overrides: Partial<LeaderboardDependencies> = {}) {
  const dependencies = { ...defaultDependencies, ...overrides };
  const app = new Hono();

  app.get('/current', async (c) => {
    const pagination = parsePagination((name) => c.req.query(name));
    if (!pagination.success)
      return c.json({ error: 'offset and limit must be bounded integers.' }, 400);
    try {
      const prisma = dependencies.getPrisma();
      const now = dependencies.now();
      const result = await dependencies.getCurrent(prisma, now, pagination.data);
      return c.json({
        period: serializePeriod(result.period),
        asOf: result.asOf.toISOString(),
        total: result.total,
        offset: result.offset,
        limit: result.limit,
        rows: result.rows.map(serializeRow),
      });
    } catch (error) {
      return c.json(
        { error: 'The leaderboard API is not configured.' },
        503,
        reportBackendError('GET /api/leaderboard/current', error),
      );
    }
  });

  app.get('/current/:address', async (c) => {
    const address = c.req.param('address');
    if (!isAddress(address)) return c.json({ error: 'A valid wallet address is required.' }, 400);
    try {
      const prisma = dependencies.getPrisma();
      const now = dependencies.now();
      const result = await dependencies.getWalletPosition(
        prisma,
        getAddress(address).toLowerCase(),
        now,
      );
      return c.json({
        period: serializePeriod(result.period),
        asOf: result.asOf.toISOString(),
        row: result.row ? serializeRow(result.row) : null,
        distanceToNextRankMicros: result.distanceToNextRankMicros,
      });
    } catch (error) {
      return c.json(
        { error: 'The leaderboard API is not configured.' },
        503,
        reportBackendError('GET /api/leaderboard/current/:address', error),
      );
    }
  });

  return app;
}
