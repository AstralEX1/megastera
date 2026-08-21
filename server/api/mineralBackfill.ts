import { pathToFileURL } from 'node:url';
import { loadMineralEconomyConfig } from './backendConfig.js';
import { disconnectPrisma, getPrismaClient } from './database.js';
import {
  type MineralAccountsBackfillResult,
  runMineralAccountsBackfill,
} from './mineralAccounts.js';

export type MineralBackfillCliOptions = { dryRun: boolean };

export function parseMineralBackfillArgs(args: readonly string[]): MineralBackfillCliOptions {
  let dryRun = false;
  for (const arg of args) {
    if (arg === '--dry-run') {
      dryRun = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return { dryRun };
}

export function formatMineralBackfillResult(
  result: MineralAccountsBackfillResult,
  dryRun: boolean,
): string {
  return [
    `Mineral account backfill ${dryRun ? 'dry run' : 'complete'}.`,
    `Cutover: ${result.cutoverAt.toISOString()}`,
    `Candidates: ${result.candidateCount}`,
    `Existing accounts: ${result.existingCount}`,
    `Missing accounts: ${result.missingCount}`,
    `Opening balance (all): ${result.openingBalanceMicros.toString()} micros`,
    `Missing opening balance: ${result.missingOpeningBalanceMicros.toString()} micros`,
    `Created accounts: ${result.createdCount}`,
  ].join('\n');
}

function requiredDatabaseUrl(env: Record<string, string | undefined>): string {
  const value = env.DATABASE_URL?.trim();
  if (!value) throw new Error('Missing required server environment variable DATABASE_URL.');
  return value;
}

export async function runMineralBackfillCommand(
  env: Record<string, string | undefined> = process.env,
  args: readonly string[] = process.argv.slice(2),
): Promise<{ result: MineralAccountsBackfillResult; dryRun: boolean }> {
  const options = parseMineralBackfillArgs(args);
  const { mineralEconomyCutoverAt } = loadMineralEconomyConfig(env);
  if (!mineralEconomyCutoverAt) {
    throw new Error('Mineral backfill is disabled: MINERAL_ECONOMY_CUTOVER_AT is not configured.');
  }
  const prisma = getPrismaClient(requiredDatabaseUrl(env));
  try {
    const result = await runMineralAccountsBackfill(prisma, mineralEconomyCutoverAt, options);
    return { result, dryRun: options.dryRun };
  } finally {
    await disconnectPrisma();
  }
}

export async function main(): Promise<void> {
  const { result, dryRun } = await runMineralBackfillCommand();
  process.stdout.write(`${formatMineralBackfillResult(result, dryRun)}\n`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch(() => {
    process.stderr.write('Mineral account backfill failed.\n');
    process.exitCode = 1;
  });
}
