import { pathToFileURL } from 'node:url';
import { loadMineralEconomyConfig } from './backendConfig.js';
import { disconnectPrisma, getPrismaClient } from './database.js';
import type { PrismaClient } from './generated/prisma/client.js';
import {
  getPostgresClockTimestamp,
  prepareMineralEconomyCutover,
  readMineralEconomyCutover,
} from './mineralAccounts.js';

export type MineralCutoverPrepareCliOptions = {
  cutoverAt: Date;
  dryRun: boolean;
};

export type MineralCutoverPrepareResult = {
  cutoverAt: Date;
  databaseNow: Date;
  dryRun: boolean;
  persisted: boolean;
};

function parseCutoverAt(raw: string): Date {
  const value = loadMineralEconomyConfig({
    MINERAL_ECONOMY_CUTOVER_AT: raw,
  }).mineralEconomyCutoverAt;
  if (!value) throw new Error('A cutover timestamp is required.');
  return value;
}

export function parseMineralCutoverPrepareArgs(
  args: readonly string[],
): MineralCutoverPrepareCliOptions {
  let cutoverAt: Date | undefined;
  let dryRun = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (arg === '--cutover-at') {
      if (cutoverAt) throw new Error('The --cutover-at argument may only be provided once.');
      const raw = args[index + 1];
      if (!raw || raw.startsWith('--')) throw new Error('Missing value for --cutover-at.');
      cutoverAt = parseCutoverAt(raw);
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!cutoverAt) throw new Error('Missing required --cutover-at argument.');
  return { cutoverAt, dryRun };
}

function validateCutoverAt(cutoverAt: Date): Date {
  if (!(cutoverAt instanceof Date) || !Number.isFinite(cutoverAt.getTime())) {
    throw new Error('Mineral economy cutover timestamp is invalid.');
  }
  return parseCutoverAt(cutoverAt.toISOString());
}

export async function prepareMineralCutover(
  prisma: PrismaClient,
  cutoverAt: Date,
  options: { dryRun?: boolean } = {},
): Promise<MineralCutoverPrepareResult> {
  const normalizedCutoverAt = validateCutoverAt(cutoverAt);
  const dryRun = options.dryRun ?? false;

  if (dryRun) {
    return prisma.$transaction(async (transaction) => {
      const databaseNow = await getPostgresClockTimestamp(transaction);
      if (databaseNow.getTime() >= normalizedCutoverAt.getTime()) {
        throw new Error('Mineral economy cutover must be in the future of PostgreSQL time.');
      }
      const persisted = await readMineralEconomyCutover(transaction);
      if (persisted && persisted.getTime() !== normalizedCutoverAt.getTime()) {
        throw new Error(
          'Configured mineral economy cutover conflicts with the persisted database cutover.',
        );
      }
      return { cutoverAt: normalizedCutoverAt, databaseNow, dryRun, persisted: false };
    });
  }

  await prepareMineralEconomyCutover(prisma, normalizedCutoverAt);
  const databaseNow = await prisma.$transaction((transaction) =>
    getPostgresClockTimestamp(transaction),
  );
  return { cutoverAt: normalizedCutoverAt, databaseNow, dryRun, persisted: true };
}

export function formatMineralCutoverPrepareResult(result: MineralCutoverPrepareResult): string {
  return [
    `Mineral economy cutover ${result.dryRun ? 'dry run' : 'prepared'}.`,
    `Cutover: ${result.cutoverAt.toISOString()}`,
    `PostgreSQL time: ${result.databaseNow.toISOString()}`,
    `Persisted: ${result.persisted ? 'yes' : 'no'}`,
  ].join('\n');
}

function requiredDatabaseUrl(env: Record<string, string | undefined>): string {
  const value = env.DIRECT_URL?.trim() || env.DATABASE_URL?.trim();
  if (!value)
    throw new Error('Missing required server environment variable DIRECT_URL or DATABASE_URL.');
  return value;
}

export async function runMineralCutoverPrepareCommand(
  env: Record<string, string | undefined> = process.env,
  args: readonly string[] = process.argv.slice(2),
): Promise<MineralCutoverPrepareResult> {
  const options = parseMineralCutoverPrepareArgs(args);
  const prisma = getPrismaClient(requiredDatabaseUrl(env));
  try {
    return await prepareMineralCutover(prisma, options.cutoverAt, options);
  } finally {
    await disconnectPrisma();
  }
}

export async function main(): Promise<void> {
  const result = await runMineralCutoverPrepareCommand();
  process.stdout.write(`${formatMineralCutoverPrepareResult(result)}\n`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch(() => {
    process.stderr.write('Mineral economy cutover prepare failed.\n');
    process.exitCode = 1;
  });
}
