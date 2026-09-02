import type { LeaderboardRow } from '@/hooks/useLeaderboard';
import { formatMinerals } from '@/lib/minerals';

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function isWallet(row: LeaderboardRow, walletAddress?: string) {
  return !!walletAddress && row.walletAddress.toLowerCase() === walletAddress.toLowerCase();
}

type RankTier = 'gold' | 'silver' | 'bronze' | 'quiet' | 'ordinary';

function rankTier(rank: number): RankTier {
  if (rank === 1) return 'gold';
  if (rank === 2) return 'silver';
  if (rank === 3) return 'bronze';
  if (rank === 4 || rank === 5) return 'quiet';
  return 'ordinary';
}

const RANK_BADGE_CLASSES: Record<RankTier, string> = {
  gold: 'border-[var(--warning)] bg-[rgba(255,184,77,0.1)] text-[var(--warning)]',
  silver: 'border-[var(--text-secondary)] bg-[rgba(150,154,173,0.1)] text-[var(--text-primary)]',
  bronze: 'border-[#c58b62] bg-[rgba(197,139,98,0.1)] text-[#d8a27c]',
  quiet: 'border-[var(--border-strong)] bg-[var(--surface-hover)] text-[var(--text-secondary)]',
  ordinary: 'border-transparent bg-transparent text-[var(--text-primary)]',
};

const RANK_ROW_CLASSES: Record<RankTier, string> = {
  gold: 'bg-[linear-gradient(90deg,rgba(255,184,77,0.08),transparent)]',
  silver: 'bg-[linear-gradient(90deg,rgba(150,154,173,0.06),transparent)]',
  bronze: 'bg-[linear-gradient(90deg,rgba(197,139,98,0.06),transparent)]',
  quiet: 'bg-[linear-gradient(90deg,rgba(150,154,173,0.04),transparent)]',
  ordinary: '',
};

function RankBadge({ rank }: { rank: number }) {
  const tier = rankTier(rank);
  return (
    <span
      data-rank={rank}
      data-rank-tier={tier}
      className={`inline-flex min-w-10 items-center justify-center rounded-lg border px-2 py-1 font-hud text-sm font-bold ${RANK_BADGE_CLASSES[tier]}`}
    >
      #{rank}
    </span>
  );
}

function AchievementStars({ count }: { count: number }) {
  return (
    <span
      role="img"
      aria-label={`${count} achievement stars`}
      className="inline-flex items-center justify-end gap-1 font-mono text-sm font-semibold tabular-nums text-amber-300"
    >
      <span aria-hidden="true">★</span>
      {count}
    </span>
  );
}

type LeaderboardTableProps = {
  rows: LeaderboardRow[];
  walletAddress?: string;
  maximumFractionDigits?: number;
  showRate?: boolean;
};

export function LeaderboardTable({
  rows,
  walletAddress,
  maximumFractionDigits = 2,
  showRate = true,
}: LeaderboardTableProps) {
  const showAchievementStars = rows.some((row) => row.achievementStars !== undefined);

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
      <table aria-label="Leaderboard standings" className="hidden w-full table-fixed md:table">
        <thead className="border-b border-[var(--border)] bg-[var(--surface-raised)] text-left font-medium telemetry text-[var(--text-secondary)]">
          <tr className="h-14">
            <th className="w-20 px-4">Rank</th>
            <th className="px-4">Wallet</th>
            <th className="px-4 text-right">Minerals</th>
            {showAchievementStars ? <th className="w-24 px-4 text-right">Stars</th> : null}
            {showRate ? <th className="px-4 text-right">Per day</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const own = isWallet(row, walletAddress);
            const tier = rankTier(row.rank);
            const score = formatMinerals(BigInt(row.scoreMicros), maximumFractionDigits);
            const perDay = formatMinerals(
              BigInt(row.effectiveMineralsPerDayMicros),
              maximumFractionDigits,
            );
            return (
              <tr
                key={row.walletAddress}
                data-wallet-row={own ? 'true' : undefined}
                data-rank-tier={tier}
                className={`h-[52px] border-b border-[var(--border)] last:border-0 ${RANK_ROW_CLASSES[tier]} ${own ? 'bg-violet-500/10' : ''}`}
              >
                <td className="px-4 py-2">
                  <RankBadge rank={row.rank} />
                </td>
                <td
                  className="px-4 py-2 font-mono text-sm text-[var(--text-secondary)]"
                  title={row.walletAddress}
                >
                  {shortAddress(row.walletAddress)}
                  {own ? <span className="ml-2 text-violet-300">You</span> : null}
                </td>
                <td className="px-4 py-2 text-right font-hud font-bold tabular-nums text-[var(--text-primary)]">
                  {score}
                </td>
                {showAchievementStars ? (
                  <td className="px-4 py-2 text-right">
                    {row.achievementStars === undefined ? (
                      <span className="text-[var(--text-muted)]">-</span>
                    ) : (
                      <AchievementStars count={row.achievementStars} />
                    )}
                  </td>
                ) : null}
                {showRate ? (
                  <td className="px-4 py-2 text-right font-mono text-sm tabular-nums text-[var(--text-secondary)]">
                    {perDay}
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
      <div data-mobile-standings className="divide-y divide-[var(--border)] md:hidden">
        {rows.map((row) => {
          const own = isWallet(row, walletAddress);
          const tier = rankTier(row.rank);
          const score = formatMinerals(BigInt(row.scoreMicros), maximumFractionDigits);
          const perDay = formatMinerals(
            BigInt(row.effectiveMineralsPerDayMicros),
            maximumFractionDigits,
          );
          return (
            <article
              key={row.walletAddress}
              data-wallet-row={own ? 'true' : undefined}
              data-rank-tier={tier}
              className={`grid grid-cols-[auto_1fr_auto] items-center gap-3 p-4 ${RANK_ROW_CLASSES[tier]} ${own ? 'bg-violet-500/10' : ''}`}
            >
              <RankBadge rank={row.rank} />
              <span className="min-w-0 truncate font-mono text-xs text-[var(--text-secondary)]">
                {shortAddress(row.walletAddress)}
                {own ? <span className="ml-2 text-violet-300">You</span> : null}
              </span>
              <div className="text-right">
                <p className="font-hud font-bold tabular-nums text-[var(--text-primary)]">
                  {score}
                </p>
                {row.achievementStars === undefined ? null : (
                  <p className="mt-0.5">
                    <AchievementStars count={row.achievementStars} />
                  </p>
                )}
                {showRate ? (
                  <p className="font-mono text-[11px] tabular-nums text-[var(--text-secondary)]">
                    +{perDay}/day
                  </p>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
