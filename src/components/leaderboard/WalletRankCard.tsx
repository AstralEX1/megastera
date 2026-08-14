import CountUp from '@/components/common/CountUp';
import type { WalletLeaderboardPosition } from '@/hooks/useLeaderboard';
import { formatMinerals } from '@/lib/minerals';

function toMineralNumber(micros: string) {
  return Number(formatMinerals(BigInt(micros)).replaceAll(',', ''));
}

export function WalletRankCard({ position }: { position: WalletLeaderboardPosition }) {
  if (!position.row) return (
    <aside className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="telemetry text-[var(--text-secondary)]">Your rank</p>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">Reveal a Planet to appear in the next daily snapshot.</p>
    </aside>
  );
  return (
    <aside className="rounded-2xl border border-violet-400/60 bg-violet-500/10 p-4 shadow-[0_18px_45px_rgba(0,0,0,0.35)] lg:sticky lg:top-28">
      <p className="telemetry text-violet-200">Your rank</p>
      <div className="mt-2 flex items-end justify-between gap-4">
        <p className="font-hud text-4xl font-bold text-[var(--text-primary)]">#{position.row.rank}</p>
        <p className="font-hud text-xl font-bold text-[var(--text-primary)]"><CountUp to={toMineralNumber(position.row.scoreMicros)} separator="," duration={0.5} className="count-up-text" /></p>
      </div>
      {position.distanceToNextRankMicros ? <p className="mt-3 font-mono text-xs text-[var(--text-secondary)]"><CountUp to={toMineralNumber(position.distanceToNextRankMicros)} separator="," duration={0.5} className="count-up-text" /> to next rank</p> : <p className="mt-3 font-mono text-xs text-amber-200">Holding the lead</p>}
    </aside>
  );
}
