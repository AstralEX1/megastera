import { describe, expect, it, vi } from 'vitest';
import { assertGalaxyPulseFresh, isGalaxyPulseFreshnessError } from './galaxyPulseFreshness.js';
import type { PrismaClient } from './generated/prisma/client.js';

const active = {
  id: '151',
  status: 'active',
  ended_at: '2026-08-22T17:00:00.000Z',
};
const settled = {
  id: '150',
  status: 'settled',
  settled_at: '2026-08-21T17:00:11.000Z',
};

function response(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('Galaxy Pulse economic freshness', () => {
  it('accepts only when official active, latest-settled, and DB Pulse agree', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(response(active))
      .mockResolvedValueOnce(response(settled));
    const prisma = {
      galaxyPulseRound: {
        findFirst: vi.fn().mockResolvedValue({ drawingId: { toString: () => '150' } }),
      },
    } as unknown as PrismaClient;

    await expect(
      assertGalaxyPulseFresh({
        prisma,
        galaxyPulseStartBlock: 1n,
        now: new Date('2026-08-22T16:59:00.000Z'),
        fetchImpl,
      }),
    ).resolves.toBeUndefined();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('fails closed after drawing time until the API and worker DB have advanced', async () => {
    const prisma = {
      galaxyPulseRound: {
        findFirst: vi.fn().mockResolvedValue({ drawingId: { toString: () => '150' } }),
      },
    } as unknown as PrismaClient;
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(response(active))
      .mockResolvedValueOnce(response(settled));

    await expect(
      assertGalaxyPulseFresh({
        prisma,
        galaxyPulseStartBlock: 1n,
        now: new Date(active.ended_at),
        fetchImpl,
      }),
    ).rejects.toThrow('Galaxy Pulse is not fresh');
  });

  it('fails closed when the latest official settlement is not persisted', async () => {
    const prisma = {
      galaxyPulseRound: {
        findFirst: vi.fn().mockResolvedValue({ drawingId: { toString: () => '149' } }),
      },
    } as unknown as PrismaClient;
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(response(active))
      .mockResolvedValueOnce(response(settled));

    await expect(
      assertGalaxyPulseFresh({
        prisma,
        galaxyPulseStartBlock: 1n,
        now: new Date('2026-08-22T16:59:00.000Z'),
        fetchImpl,
      }),
    ).rejects.toThrow('Galaxy Pulse is not fresh');
  });

  it('does no network or DB work while Pulse is disabled', async () => {
    const fetchImpl = vi.fn();
    const findFirst = vi.fn();
    await assertGalaxyPulseFresh({
      prisma: { galaxyPulseRound: { findFirst } } as unknown as PrismaClient,
      galaxyPulseStartBlock: null,
      now: new Date(),
      fetchImpl,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('normalizes network failures to the retryable freshness error', async () => {
    const request = assertGalaxyPulseFresh({
      prisma: { galaxyPulseRound: { findFirst: vi.fn() } } as unknown as PrismaClient,
      galaxyPulseStartBlock: 1n,
      now: new Date('2026-08-22T16:59:00.000Z'),
      fetchImpl: vi.fn().mockRejectedValue(new TypeError('network down')),
    });

    await expect(request).rejects.toSatisfy(isGalaxyPulseFreshnessError);
  });
});
