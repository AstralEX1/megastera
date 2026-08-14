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

type RankTier = 'gold' | 'silver' | 'bronze' | 'top-ten' | 'standard';

const RANK_TIER_STYLES: Record<RankTier, { row: string; badge: string }> = {
  gold: {
    row: 'border-l-2 border-l-amber-300/70 bg-amber-200/[0.045]',
    badge: 'border-amber-200/35 bg-amber-300/10 text-amber-100',
  },
  silver: {
    row: 'border-l-2 border-l-slate-200/60 bg-slate-200/[0.04]',
    badge: 'border-slate-200/35 bg-slate-200/10 text-slate-100',
  },
  bronze: {
    row: 'border-l-2 border-l-orange-300/65 bg-orange-200/[0.04]',
    badge: 'border-orange-200/35 bg-orange-300/10 text-orange-100',
  },
  'top-ten': {
    row: 'border-l-2 border-l-cyan-300/45 bg-cyan-300/[0.028]',
    badge: 'border-cyan-200/25 bg-cyan-300/[0.06] text-cyan-100',
  },
  standard: {
    row: 'border-l-2 border-l-transparent',
    badge: 'border-[var(--border)] bg-[var(--surface-raised)] text-[var(--text-primary)]',
  },
};

function getRankTier(rank: number): RankTier {
  if (rank === 1) return 'gold';
  if (rank === 2) return 'silver';
  if (rank === 3) return 'bronze';
  if (rank >= 4 && rank <= 10) return 'top-ten';
  return 'standard';
}

export function LeaderboardTable({
  rows,
  walletAddress,
}: {
  rows: LeaderboardRow[];
  walletAddress?: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
      <table className="hidden w-full table-fixed md:table">
        <thead className="border-b border-[var(--border)] bg-[var(--surface-raised)] text-left telemetry text-[var(--text-secondary)]">
          <tr>
            <th className="w-20 px-4 py-3">Rank</th>
            <th className="px-4 py-3">Wallet</th>
            <th className="px-4 py-3 text-right">Minerals</th>
            <th className="px-4 py-3 text-right">Per day</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const own = isWallet(row, walletAddress);
            const score = toMineralNumber(row.scoreMicros);
            const perDay = toMineralNumber(row.effectiveMineralsPerDayMicros);
            const tier = getRankTier(row.rank);
            const tierStyles = RANK_TIER_STYLES[tier];
            return (
              <tr
                key={row.walletAddress}
                data-wallet-row={own ? 'true' : undefined}
                data-rank-tier={tier}
                className={`border-b border-[var(--border)] last:border-0 ${tierStyles.row} ${own ? 'bg-violet-500/10 ring-1 ring-inset ring-violet-300/40' : ''}`}
              >
                <td className="px-4 py-4">
                  <span
                    className={`inline-flex min-w-10 items-center justify-center rounded-lg border px-2 py-1 font-hud text-sm font-bold ${tierStyles.badge}`}
                  >
                    #{row.rank}
                  </span>
                </td>
                <td
                  className="px-4 py-4 font-mono text-sm text-[var(--text-secondary)]"
                  title={row.walletAddress}
                >
                  {shortAddress(row.walletAddress)}
                  {own ? <span className="ml-2 text-violet-300">You</span> : null}
                </td>
                <td className="px-4 py-4 text-right font-hud font-bold text-[var(--text-primary)]">
                  <CountUp to={score} separator="," duration={0.5} className="count-up-text" />
                </td>
                <td className="px-4 py-4 text-right font-mono text-sm text-[var(--text-secondary)]">
                  <CountUp to={perDay} separator="," duration={0.5} className="count-up-text" />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div data-mobile-standings className="divide-y divide-[var(--border)] md:hidden">
        {rows.map((row) => {
          const own = isWallet(row, walletAddress);
          const score = toMineralNumber(row.scoreMicros);
          const perDay = toMineralNumber(row.effectiveMineralsPerDayMicros);
          const tier = getRankTier(row.rank);
          const tierStyles = RANK_TIER_STYLES[tier];
          return (
            <article
              key={row.walletAddress}
              data-wallet-row={own ? 'true' : undefined}
              data-rank-tier={tier}
              className={`grid grid-cols-[auto_1fr_auto] items-center gap-3 p-4 ${tierStyles.row} ${own ? 'bg-violet-500/10 ring-1 ring-inset ring-violet-300/40' : ''}`}
            >
              <span
                className={`inline-flex min-w-10 items-center justify-center rounded-lg border px-2 py-1 font-hud text-base font-bold ${tierStyles.badge}`}
              >
                #{row.rank}
              </span>
              <span className="min-w-0 truncate font-mono text-xs text-[var(--text-secondary)]">
                {shortAddress(row.walletAddress)}
              </span>
              <div className="text-right">
                <p className="font-hud font-bold text-[var(--text-primary)]">
                  <CountUp to={score} separator="," duration={0.5} className="count-up-text" />
                </p>
                <p className="font-mono text-[11px] text-[var(--text-secondary)]">
                  +<CountUp to={perDay} separator="," duration={0.5} className="count-up-text" />
                  /day
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
