import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from './generated/prisma/client.js';
import {
  ensureMineralEconomyCutover,
  prepareMineralEconomyCutover,
  resolveMineralEconomyCutover,
} from './mineralAccounts.js';

const CUTOVER = new Date('2026-08-20T00:00:00.000Z');

describe('Mineral economy cutover invariant', () => {
  it('resolves a configured future cutover as staged without persisting it', async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const createMany = vi.fn();
    const prisma = {
      mineralEconomyCutover: { findUnique, createMany },
    } as unknown as PrismaClient;

    await expect(resolveMineralEconomyCutover(prisma, CUTOVER)).resolves.toEqual({
      state: 'STAGED_V2',
      cutoverAt: CUTOVER,
      source: 'config',
    });
    expect(createMany).not.toHaveBeenCalled();
  });

  it('uses the persisted cutover when configuration is absent', async () => {
    const row = { id: 1, cutoverAt: CUTOVER };
    const prisma = {
      mineralEconomyCutover: { findUnique: vi.fn().mockResolvedValue(row) },
    } as unknown as PrismaClient;

    await expect(resolveMineralEconomyCutover(prisma, null)).resolves.toEqual({
      state: 'V2',
      cutoverAt: CUTOVER,
      source: 'database',
    });
  });

  it('fails closed when configured and persisted cutovers conflict', async () => {
    const prisma = {
      mineralEconomyCutover: {
        findUnique: vi.fn().mockResolvedValue({
          id: 1,
          cutoverAt: new Date('2026-08-21T00:00:00.000Z'),
        }),
      },
    } as unknown as PrismaClient;

    await expect(resolveMineralEconomyCutover(prisma, CUTOVER)).rejects.toThrow(
      'conflicts with the persisted database cutover',
    );
  });

  it('persists a prepared future cutover only inside the explicit command', async () => {
    const create = vi.fn().mockResolvedValue({ id: 1, cutoverAt: CUTOVER });
    const transaction = {
      $queryRaw: vi.fn()
        .mockResolvedValueOnce([{ locked: 1 }])
        .mockResolvedValueOnce([{ now: new Date('2026-08-19T00:00:00.000Z') }]),
      mineralEconomyCutover: {
        findUnique: vi.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ id: 1, cutoverAt: CUTOVER }),
        create,
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (value: typeof transaction) => unknown) => callback(transaction)),
    } as unknown as PrismaClient;

    await expect(prepareMineralEconomyCutover(prisma, CUTOVER)).resolves.toEqual({
      id: 1,
      cutoverAt: CUTOVER,
    });
    expect(create).toHaveBeenCalledWith({ data: { id: 1, cutoverAt: CUTOVER } });
  });

  it('creates the singleton once and rejects a configured conflict', async () => {
    const row = { id: 1, cutoverAt: CUTOVER };
    const findUnique = vi.fn().mockResolvedValueOnce(row).mockResolvedValueOnce(row);
    const createMany = vi.fn().mockResolvedValue({ count: 1 });
    const prisma = { mineralEconomyCutover: { findUnique, createMany } } as unknown as PrismaClient;

    await expect(ensureMineralEconomyCutover(prisma, CUTOVER)).resolves.toEqual(row);
    await expect(
      ensureMineralEconomyCutover(prisma, new Date('2026-08-21T00:00:00.000Z')),
    ).rejects.toThrow('conflicts with the persisted database cutover');
    expect(createMany).toHaveBeenCalledTimes(2);
  });
});
