import { describe, expect, it } from 'vitest';
import {
  formatMineralBackfillResult,
  parseMineralBackfillArgs,
  runMineralBackfillCommand,
} from './mineralBackfill.js';

describe('Mineral account backfill CLI', () => {
  it('parses the optional dry-run flag and rejects unknown arguments', () => {
    expect(parseMineralBackfillArgs([])).toEqual({ dryRun: false });
    expect(parseMineralBackfillArgs(['--dry-run'])).toEqual({ dryRun: true });
    expect(() => parseMineralBackfillArgs(['--force'])).toThrow('Unknown argument: --force');
  });

  it('prints counts and bigint totals without exposing database configuration', () => {
    const output = formatMineralBackfillResult(
      {
        cutoverAt: new Date('2026-08-20T00:00:00.000Z'),
        candidateCount: 4,
        existingCount: 1,
        missingCount: 3,
        openingBalanceMicros: 615_000_000n,
        missingOpeningBalanceMicros: 500_000_000n,
        createdCount: 3,
      },
      false,
    );

    expect(output).toContain('Candidates: 4');
    expect(output).toContain('Existing accounts: 1');
    expect(output).toContain('Missing accounts: 3');
    expect(output).toContain('Opening balance (all): 615000000 micros');
    expect(output).toContain('Missing opening balance: 500000000 micros');
    expect(output).toContain('Created accounts: 3');
    expect(output).toContain('2026-08-20T00:00:00.000Z');
  });

  it('refuses to run when the economy cutover is not configured', async () => {
    await expect(
      runMineralBackfillCommand({ DATABASE_URL: 'postgresql://example.test/db' }, []),
    ).rejects.toThrow('Mineral backfill is disabled');
  });
});
