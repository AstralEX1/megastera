import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from './generated/prisma/client.js';
import { ensureMineralEconomyCutover } from './mineralAccounts.js';

const CUTOVER = new Date('2026-08-20T00:00:00.000Z');

describe('Mineral economy cutover invariant', () => {
  it('creates the singleton once and rejects a configured conflict', async () => {
    const row = { id: 1, cutoverAt: CUTOVER };
    const findUnique = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(row);
    const create = vi.fn().mockResolvedValue(row);
    const prisma = { mineralEconomyCutover: { findUnique, create } } as unknown as PrismaClient;

    await expect(ensureMineralEconomyCutover(prisma, CUTOVER)).resolves.toEqual(row);
    await expect(
      ensureMineralEconomyCutover(prisma, new Date('2026-08-21T00:00:00.000Z')),
    ).rejects.toThrow('conflicts with the persisted database cutover');
    expect(create).toHaveBeenCalledOnce();
  });
});
