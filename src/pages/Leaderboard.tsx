import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { Button } from '@/components/common/Button';
import { FadeArc } from '@/components/common/FadeArc';
import { PlanetIcon, TicketsIcon } from '@/components/icons/TicketsIcon';
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable';
import { WalletRankCard } from '@/components/leaderboard/WalletRankCard';
import { AchievementsPanel } from '@/components/planets/AchievementsPanel';
import { useCurrentLeaderboard, useWalletLeaderboardPosition } from '@/hooks/useLeaderboard';
import { useWalletMining } from '@/hooks/useWalletMining';

const SEASON_END_AT = Date.parse('2026-08-28T23:59:00.000Z');

const SEASON_REWARDS = [
  { label: 'Megapot Tickets', detail: '(USDC)', icon: TicketsIcon },
  { label: '1/1 NFT Planets', detail: null, icon: PlanetIcon },
] as const;

function relativeTimeLabel(timestamp: number | undefined, now: number) {
  if (!timestamp || !Number.isFinite(timestamp)) return 'waiting for first refresh';

  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'} ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;

  const hours = Math.floor(minutes / 60);
  return `${hours} hour${hours === 1 ? '' : 's'} ago`;
}

function seasonCountdownLabel(now: number) {
  const remainingSeconds = Math.max(0, Math.floor((SEASON_END_AT - now) / 1000));
  if (remainingSeconds === 0) return 'Season ended';

  const days = Math.floor(remainingSeconds / 86_400);
  const hours = Math.floor((remainingSeconds % 86_400) / 3_600);
  const minutes = Math.floor((remainingSeconds % 3_600) / 60);
  const seconds = remainingSeconds % 60;

  return `${String(days).padStart(2, '0')}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
}

export function Leaderboard() {
  const { address } = useAccount();
  const current = useCurrentLeaderboard();
  const wallet = useWalletLeaderboardPosition(address);
  const mining = useWalletMining(address);
  const data = current.data;
  const [now, setNow] = useState(() => Date.now());
  const [manualRefreshing, setManualRefreshing] = useState(false);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  const handleRefresh = async () => {
    const startedAt = Date.now();
    setManualRefreshing(true);

    try {
      await Promise.all([
        current.refetch(),
        address ? wallet.refetch() : Promise.resolve(),
        address ? mining.refetch() : Promise.resolve(),
      ]);

      const remaining = 500 - (Date.now() - startedAt);
      if (remaining > 0) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, remaining));
      }
    } finally {
      setManualRefreshing(false);
      setNow(Date.now());
    }
  };

  if (current.isLoading) {
    return (
      <section aria-live="polite" className="card-pad mx-auto flex max-w-3xl flex-col items-center text-center">
        <FadeArc aria-label="Loading leaderboard" className="h-10 w-10 text-violet-300 [--duration:1.1s]" />
        <h1 className="mt-5 font-hud text-2xl font-bold">Loading leaderboard</h1>
      </section>
    );
  }
  const refreshing = current.isFetching || manualRefreshing;
  const lastRefreshAt = current.dataUpdatedAt || (data?.asOf ? Date.parse(data.asOf) : undefined);
  const seasonOverview = (
    <section aria-label="Season overview" className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="space-y-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-secondary)]">Season prizes</p>
          <div className="mt-2 grid gap-2 text-sm">
            {SEASON_REWARDS.map(({ label, detail, icon: Icon }, index) => (
              <div key={label} className={`flex items-center gap-2 ${index > 0 ? 'border-t border-[var(--border)] pt-2' : ''}`}>
                <Icon className="h-4 w-4 shrink-0 text-[var(--warning)]" />
                <span className="font-semibold text-[var(--text-primary)]">{label}</span>
                {detail ? <span className="text-[var(--text-secondary)]">{detail}</span> : null}
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-[var(--border)] pt-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-secondary)]">Season ends in</p>
          <output aria-label="Season ends in" className="mt-1 block font-mono text-sm tabular-nums text-[var(--text-primary)]" role="timer" title="28 August 2026, 23:59 UTC">
            {seasonCountdownLabel(now)}
          </output>
        </div>
      </div>
    </section>
  );

  return (
    <div className="space-y-5">
      <header className="flex flex-col items-start justify-between gap-4 border-b border-[var(--border)] pb-5 sm:flex-row sm:flex-wrap sm:items-end">
        <div>
          <h1 className="font-hud text-3xl font-bold tracking-[-0.04em] text-[var(--text-primary)]">Leaderboard</h1>
        </div>
        <div className="grid w-full grid-cols-[auto_minmax(0,1fr)] items-end gap-3 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
          <div className="min-w-[5.5rem] text-left sm:text-right">
            <span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-secondary)]">Active players</span>
            <span className="block font-mono text-sm tabular-nums text-[var(--text-primary)]">{data?.total.toLocaleString() ?? '—'}</span>
          </div>
          <span className="min-w-0 text-right font-mono text-xs text-[var(--text-secondary)] sm:text-left">Last refresh: {relativeTimeLabel(lastRefreshAt, now)}</span>
          <Button
            variant="secondary"
            className="col-span-2 w-full sm:w-auto"
            disabled={refreshing}
            aria-busy={refreshing}
            aria-label={refreshing ? 'Refreshing leaderboard' : 'Refresh'}
            onClick={() => void handleRefresh()}
          >
            {refreshing ? (
              <span className="inline-flex items-center gap-2">
                <span aria-hidden className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Refreshing…
              </span>
            ) : 'Refresh'}
          </Button>
        </div>
      </header>

      {current.error || !data ? (
        <div className="space-y-5">
          {seasonOverview}
          <section role="alert" className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
            <h2 className="font-hud text-xl font-bold">Leaderboard unavailable</h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">The live mining backend could not return current standings.</p>
            <Button variant="secondary" onClick={() => void handleRefresh()}>Retry</Button>
          </section>
        </div>
      ) : data.rows.length === 0 ? (
        <div className="space-y-5">
          {seasonOverview}
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center"><h2 className="font-hud text-xl font-bold">No mineral production yet</h2><p className="mt-2 text-sm text-[var(--text-secondary)]">Standings appear after the first backend Planet begins mining.</p></section>
        </div>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_17rem]">
          <LeaderboardTable rows={data.rows} walletAddress={address} />
          <aside aria-label="Leaderboard details" className="space-y-5">
            {seasonOverview}
            {address && wallet.data ? (
              <>
                <WalletRankCard position={wallet.data} />
                {mining.data?.achievements.length ? (
                  <AchievementsPanel achievements={mining.data.achievements} />
                ) : null}
              </>
            ) : null}
          </aside>
        </div>
      )}
    </div>
  );
}
