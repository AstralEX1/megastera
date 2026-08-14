import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { Button } from '@/components/common/Button';
import { FadeArc } from '@/components/common/FadeArc';
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable';
import { WalletRankCard } from '@/components/leaderboard/WalletRankCard';
import { useCurrentLeaderboard, useWalletLeaderboardPosition } from '@/hooks/useLeaderboard';

function relativeTimeLabel(timestamp: number | undefined, now: number) {
  if (!timestamp || !Number.isFinite(timestamp)) return 'waiting for first refresh';

  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'} ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;

  const hours = Math.floor(minutes / 60);
  return `${hours} hour${hours === 1 ? '' : 's'} ago`;
}

const SEASON_END_AT = Date.UTC(2026, 7, 23, 23, 39, 0);
const SEASON_END_LABEL = 'August 23, 2026, 23:39 UTC';

function getSeasonCountdown(now: number) {
  const remainingSeconds = Math.max(0, Math.ceil((SEASON_END_AT - now) / 1000));

  return {
    ended: now >= SEASON_END_AT,
    days: Math.floor(remainingSeconds / 86_400),
    hours: Math.floor((remainingSeconds % 86_400) / 3_600),
    minutes: Math.floor((remainingSeconds % 3_600) / 60),
    seconds: remainingSeconds % 60,
  };
}

function padCountdown(value: number) {
  return String(value).padStart(2, '0');
}

function SeasonOnePanel({ now }: { now: number }) {
  const countdown = getSeasonCountdown(now);
  const countdownUnits = [
    { label: 'DAYS', value: countdown.days },
    { label: 'HRS', value: countdown.hours },
    { label: 'MIN', value: countdown.minutes },
    { label: 'SEC', value: countdown.seconds },
  ];
  const timerLabel = countdown.ended
    ? 'Season 1 has ended.'
    : `Season 1 countdown: ${countdown.days} days, ${countdown.hours} hours, ${countdown.minutes} minutes, ${countdown.seconds} seconds remaining.`;

  return (
    <section
      aria-labelledby="season-1-title"
      data-season-panel
      className="relative overflow-hidden rounded-2xl border border-violet-300/25 bg-[var(--surface)] p-5 shadow-[0_18px_50px_rgba(4,3,16,0.28)]"
    >
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-br from-violet-400/10 via-transparent to-cyan-300/[0.06]"
      />
      <div className="relative grid gap-4 md:grid-cols-[minmax(0,1.1fr)_minmax(15rem,0.9fr)] md:items-center">
        <div>
          <div className="flex items-center justify-between gap-3">
            <h2
              id="season-1-title"
              className="font-hud text-2xl font-bold tracking-[-0.04em] text-[var(--text-primary)]"
            >
              Season 1
            </h2>
            <span className="telemetry text-cyan-200">Ends in</span>
          </div>

          {countdown.ended ? (
            <div
              role="timer"
              aria-label={timerLabel}
              data-season-countdown
              data-season-ended="true"
              className="mt-3 font-hud text-xl font-bold text-[var(--text-primary)]"
            >
              Season 1 has ended
            </div>
          ) : (
            <div
              role="timer"
              aria-label={timerLabel}
              data-season-countdown
              data-season-ended="false"
              className="mt-3 grid grid-cols-4 gap-2"
            >
              {countdownUnits.map((unit) => (
                <div
                  key={unit.label}
                  className="rounded-xl border border-violet-200/15 bg-violet-300/[0.045] px-2 py-2 text-center"
                >
                  <p className="font-hud text-xl font-bold tabular-nums text-[var(--text-primary)]">
                    {padCountdown(unit.value)}
                  </p>
                  <p className="telemetry mt-1 text-[var(--text-secondary)]">{unit.label}</p>
                </div>
              ))}
            </div>
          )}
          <p className="mt-2 font-mono text-[11px] text-[var(--text-secondary)]">
            {SEASON_END_LABEL}
          </p>
        </div>

        <div className="border-t border-[var(--border)] pt-4 md:border-l md:border-t-0 md:pl-5 md:pt-0">
          <h3 className="font-hud text-xl font-bold tracking-[-0.03em] text-[var(--text-primary)]">
            PRIZES
          </h3>
          <p className="mt-2 telemetry text-cyan-200">TOP 10 RECEIVE</p>
          <p className="mt-2 font-hud text-base font-bold text-[var(--text-primary)] sm:text-lg">
            <span>USDC</span> <span className="px-1 text-violet-200">+</span>{' '}
            <span>1/1 Planet NFT</span>
          </p>
        </div>
      </div>
    </section>
  );
}

export function Leaderboard() {
  const { address } = useAccount();
  const current = useCurrentLeaderboard();
  const wallet = useWalletLeaderboardPosition(address);
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
      await Promise.all([current.refetch(), address ? wallet.refetch() : Promise.resolve()]);

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
      <section
        aria-live="polite"
        className="card-pad mx-auto flex max-w-3xl flex-col items-center text-center"
      >
        <FadeArc
          aria-label="Loading leaderboard"
          className="h-10 w-10 text-violet-300 [--duration:1.1s]"
        />
        <h1 className="mt-5 font-hud text-2xl font-bold">Loading leaderboard</h1>
      </section>
    );
  }
  if (current.error || !data)
    return (
      <section role="alert" className="card-pad mx-auto max-w-2xl space-y-4 text-center">
        <h1 className="font-hud text-2xl font-bold">Leaderboard unavailable</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          The live mining backend could not return current standings.
        </p>
        <Button variant="secondary" onClick={() => void handleRefresh()}>
          Retry
        </Button>
      </section>
    );

  const refreshing = current.isFetching || manualRefreshing;
  const lastRefreshAt = current.dataUpdatedAt || (data.asOf ? Date.parse(data.asOf) : undefined);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <h1 className="font-hud text-3xl font-bold tracking-[-0.04em] text-[var(--text-primary)]">
            Leaderboard
          </h1>
          <p className="mt-2 max-w-xl text-sm text-[var(--text-secondary)]">
            Current lifetime mining from every backend Planet. Standings refresh automatically every
            minute.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-xs text-[var(--text-secondary)]">
            Last refresh: {relativeTimeLabel(lastRefreshAt, now)}
          </span>
          <Button
            variant="secondary"
            disabled={refreshing}
            aria-busy={refreshing}
            aria-label={refreshing ? 'Refreshing leaderboard' : 'Refresh'}
            onClick={() => void handleRefresh()}
          >
            {refreshing ? (
              <span className="inline-flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
                />
                Refreshing…
              </span>
            ) : (
              'Refresh'
            )}
          </Button>
        </div>
      </header>

      <SeasonOnePanel now={now} />

      {data.rows.length === 0 ? (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
          <h2 className="font-hud text-xl font-bold">No mineral production yet</h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Standings appear after the first backend Planet begins mining.
          </p>
        </section>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_17rem]">
          <LeaderboardTable rows={data.rows} walletAddress={address} />
          {address && wallet.data ? <WalletRankCard position={wallet.data} /> : null}
        </div>
      )}
    </div>
  );
}
