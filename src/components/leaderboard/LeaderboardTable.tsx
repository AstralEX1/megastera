import CountUp from '@/components/common/CountUp';
import type { LeaderboardRow } from '@/hooks/useLeaderboard';
import { formatMinerals } from '@/lib/minerals';

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function isWallet(row: LeaderboardRow, walletAddress?: string) {
  return !!walletAddress && row.walletAddress.toLowerCase() === walletAddress.toLowerCase();
}

function toMineralNumber(micros: string) {
  return Number(formatMinerals(BigInt(micros)).replaceAll(',', ''));
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

export function LeaderboardTable({ rows, walletAddress }: { rows: LeaderboardRow[]; walletAddress?: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
      <table className="hidden w-full table-fixed md:table">
        <thead className="border-b border-[var(--border)] bg-[var(--surface-raised)] text-left telemetry text-[var(--text-secondary)]">
          <tr><th className="w-20 px-4 py-3">Rank</th><th className="px-4 py-3">Wallet</th><th className="px-4 py-3 text-right">Minerals</th><th className="px-4 py-3 text-right">Per day</th></tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const own = isWallet(row, walletAddress);
            const tier = rankTier(row.rank);
            const score = toMineralNumber(row.scoreMicros);
            const perDay = toMineralNumber(row.effectiveMineralsPerDayMicros);
            return (
              <tr key={row.walletAddress} data-wallet-row={own ? 'true' : undefined} data-rank-tier={tier} className={`border-b border-[var(--border)] last:border-0 ${RANK_ROW_CLASSES[tier]} ${own ? 'bg-violet-500/10' : ''}`}>
                <td className="px-4 py-4"><RankBadge rank={row.rank} /></td>
                <td className="px-4 py-4 font-mono text-sm text-[var(--text-secondary)]" title={row.walletAddress}>{shortAddress(row.walletAddress)}{own ? <span className="ml-2 text-violet-300">You</span> : null}</td>
                <td className="px-4 py-4 text-right font-hud font-bold text-[var(--text-primary)]"><CountUp to={score} separator="," duration={0.5} className="count-up-text" /></td>
                <td className="px-4 py-4 text-right font-mono text-sm text-[var(--text-secondary)]"><CountUp to={perDay} separator="," duration={0.5} className="count-up-text" /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div data-mobile-standings className="divide-y divide-[var(--border)] md:hidden">
        {rows.map((row) => {
          const own = isWallet(row, walletAddress);
          const tier = rankTier(row.rank);
          const score = toMineralNumber(row.scoreMicros);
          const perDay = toMineralNumber(row.effectiveMineralsPerDayMicros);
          return (
            <article key={row.walletAddress} data-wallet-row={own ? 'true' : undefined} data-rank-tier={tier} className={`grid grid-cols-[auto_1fr_auto] items-center gap-3 p-4 ${RANK_ROW_CLASSES[tier]} ${own ? 'bg-violet-500/10' : ''}`}>
              <RankBadge rank={row.rank} />
              <span className="min-w-0 truncate font-mono text-xs text-[var(--text-secondary)]">
                {shortAddress(row.walletAddress)}
                {own ? <span className="ml-2 text-violet-300">You</span> : null}
              </span>
              <div className="text-right"><p className="font-hud font-bold text-[var(--text-primary)]"><CountUp to={score} separator="," duration={0.5} className="count-up-text" /></p><p className="font-mono text-[11px] text-[var(--text-secondary)]">+<CountUp to={perDay} separator="," duration={0.5} className="count-up-text" />/day</p></div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
