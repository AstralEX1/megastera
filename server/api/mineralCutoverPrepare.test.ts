import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from './generated/prisma/client.js';
import {
  formatMineralCutoverPrepareResult,
  parseMineralCutoverPrepareArgs,
  prepareMineralCutover,
} from './mineralCutoverPrepare.js';

const CUTOVER = new Date('2026-08-24T00:00:00.000Z');
const DATABASE_NOW = new Date('2026-08-20T12:00:00.000Z');

function makePrisma(databaseNow = DATABASE_NOW) {
  const findUnique = vi
    .fn()
    .mockResolvedValueOnce(null)
    .mockResolvedValue({ id: 1, cutoverAt: CUTOVER });
  const createMany = vi.fn().mockResolvedValue({ count: 1 });
  const transaction = {
    $queryRaw: vi.fn().mockResolvedValue([{ now: databaseNow }]),
    mineralEconomyCutover: { findUnique, createMany },
  };
  const prisma = {
    $transaction: vi.fn(async (callback: (value: typeof transaction) => unknown) =>
      callback(transaction),
    ),
  } as unknown as PrismaClient;
  return { prisma, findUnique, createMany };
}

describe('Mineral cutover prepare command', () => {
  it('requires an explicit exact UTC-midnight cutover argument', () => {
    expect(parseMineralCutoverPrepareArgs(['--cutover-at', CUTOVER.toISOString()])).toEqual({
      cutoverAt: CUTOVER,
      dryRun: false,
    });
    expect(
      parseMineralCutoverPrepareArgs(['--dry-run', '--cutover-at', CUTOVER.toISOString()]),
    ).toEqual({
      cutoverAt: CUTOVER,
      dryRun: true,
    });
    expect(() => parseMineralCutoverPrepareArgs([])).toThrow('Missing required --cutover-at');
    expect(() =>
      parseMineralCutoverPrepareArgs(['--cutover-at', '2026-08-24T12:00:00.000Z']),
    ).toThrow('exact UTC midnight');
    expect(() =>
      parseMineralCutoverPrepareArgs(['--cutover-at', CUTOVER.toISOString(), '--force']),
    ).toThrow('Unknown argument: --force');
  });

  it('dry-runs against PostgreSQL time without persisting the cutover', async () => {
    const { prisma, createMany } = makePrisma();

    await expect(prepareMineralCutover(prisma, CUTOVER, { dryRun: true })).resolves.toMatchObject({
      cutoverAt: CUTOVER,
      databaseNow: DATABASE_NOW,
      dryRun: true,
      persisted: false,
    });
    expect(createMany).not.toHaveBeenCalled();
  });

  it('persists the chosen future cutover through the existing singleton export', async () => {
    const { prisma, createMany } = makePrisma();

    await expect(prepareMineralCutover(prisma, CUTOVER)).resolves.toMatchObject({
      cutoverAt: CUTOVER,
      databaseNow: DATABASE_NOW,
      dryRun: false,
      persisted: true,
    });
    expect(createMany).toHaveBeenCalledWith({
      data: [{ id: 1, cutoverAt: CUTOVER }],
      skipDuplicates: true,
    });
  });

  it('rejects a cutover that is not in the future of PostgreSQL time', async () => {
    const { prisma, createMany } = makePrisma(new Date('2026-08-24T00:00:00.000Z'));

    await expect(prepareMineralCutover(prisma, CUTOVER)).rejects.toThrow(
      'must be in the future of PostgreSQL time',
    );
    expect(createMany).not.toHaveBeenCalled();
  });

  it('formats a safe result without connection details', () => {
    const output = formatMineralCutoverPrepareResult({
      cutoverAt: CUTOVER,
      databaseNow: DATABASE_NOW,
      dryRun: true,
      persisted: false,
    });

    expect(output).toContain('Mineral economy cutover dry run.');
    expect(output).toContain('Cutover: 2026-08-24T00:00:00.000Z');
    expect(output).toContain('PostgreSQL time: 2026-08-20T12:00:00.000Z');
    expect(output).not.toContain('postgresql://');
  });
});
