import { useAccount } from 'wagmi';
import { PlanetIcon, TicketsIcon } from '@/components/icons/TicketsIcon';
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable';
import { SEASON_ONE_LEADERBOARD_ROWS, SEASON_ONE_SNAPSHOT_AT } from '@/data/seasonOneLeaderboard';

const PODIUM_WINNERS = [
  { rank: 1, tickets: 18, walletAddress: SEASON_ONE_LEADERBOARD_ROWS[0].walletAddress },
  { rank: 2, tickets: 12, walletAddress: SEASON_ONE_LEADERBOARD_ROWS[1].walletAddress },
  { rank: 3, tickets: 6, walletAddress: SEASON_ONE_LEADERBOARD_ROWS[2].walletAddress },
] as const;

const NFT_WINNERS = [
  { rank: 4, walletAddress: SEASON_ONE_LEADERBOARD_ROWS[3].walletAddress },
  { rank: 5, walletAddress: SEASON_ONE_LEADERBOARD_ROWS[4].walletAddress },
] as const;

const PODIUM_META = {
  1: {
    ordinal: '1st',
    placement:
      'col-span-2 row-start-1 mx-auto w-full max-w-72 sm:col-span-1 sm:col-start-2 sm:max-w-none',
    medal: 'h-20 w-20 border-[#e1b94f] bg-[rgba(225,185,79,0.08)] text-[#e1b94f]',
    badge: 'border-[#e1b94f] bg-[#e1b94f] text-[#171309]',
    cap: 'bg-[#8f7531]',
    base: 'h-28 border-[#d8b45a]/60 bg-[linear-gradient(180deg,rgba(213,174,74,0.78),rgba(86,68,24,0.42))] text-[#f0ce72] sm:h-36',
  },
  2: {
    ordinal: '2nd',
    placement: 'col-start-1 row-start-2 sm:col-start-1 sm:row-start-1',
    medal: 'h-16 w-16 border-[#a6adba] bg-[rgba(166,173,186,0.08)] text-[#c5cad3]',
    badge: 'border-[#a6adba] bg-[#a6adba] text-[#12151b]',
    cap: 'bg-[#656c78]',
    base: 'h-20 border-[#a6adba]/50 bg-[linear-gradient(180deg,rgba(154,162,175,0.72),rgba(51,57,68,0.38))] text-[#d7dbe2] sm:h-24',
  },
  3: {
    ordinal: '3rd',
    placement: 'col-start-2 row-start-2 sm:col-start-3 sm:row-start-1',
    medal: 'h-16 w-16 border-[#b77b52] bg-[rgba(183,123,82,0.08)] text-[#d29a73]',
    badge: 'border-[#b77b52] bg-[#b77b52] text-[#180f0a]',
    cap: 'bg-[#744b34]',
    base: 'h-16 border-[#b77b52]/50 bg-[linear-gradient(180deg,rgba(164,106,69,0.66),rgba(65,43,31,0.38))] text-[#d3a07a] sm:h-20',
  },
} as const;

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function Leaderboard() {
  const { address } = useAccount();

  return (
    <div className="space-y-8">
      <header className="border-b border-[var(--border)] pb-6">
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--warning)]">Final</p>
        <h1 className="mt-2 font-hud text-3xl font-bold tracking-[-0.04em] text-[var(--text-primary)] sm:text-4xl">
          Season 1 results
        </h1>
      </header>

      <section aria-label="Winners" className="space-y-4">
        <h2 className="font-hud text-xl font-bold text-[var(--text-primary)]">Winners</h2>
        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[rgba(9,10,18,0.78)]">
          <ol
            aria-label="Top three podium"
            className="grid grid-cols-2 items-end gap-x-2 gap-y-8 px-3 pt-7 sm:grid-cols-3 sm:gap-x-4 sm:px-6 sm:pt-9"
          >
            {PODIUM_WINNERS.map((winner) => {
              const meta = PODIUM_META[winner.rank];
              return (
                <li key={winner.rank} className={meta.placement}>
                  <article
                    aria-label={`${meta.ordinal} place`}
                    className="flex min-w-0 flex-col text-center"
                  >
                    <div
                      className={`relative mx-auto flex shrink-0 items-center justify-center rounded-full border-2 ${meta.medal}`}
                    >
                      <PlanetIcon className={winner.rank === 1 ? 'h-9 w-9' : 'h-7 w-7'} />
                      <span
                        className={`absolute -right-2 -top-2 flex h-8 min-w-8 items-center justify-center rounded-full border px-1 font-hud text-sm font-bold ${meta.badge}`}
                      >
                        #{winner.rank}
                      </span>
                    </div>
                    <p
                      className="mt-3 truncate font-mono text-xs text-[var(--text-primary)] sm:text-sm"
                      title={winner.walletAddress}
                    >
                      {shortAddress(winner.walletAddress)}
                    </p>
                    <div className="mt-2 min-h-14 space-y-1.5">
                      <p className="flex items-center justify-center gap-1.5 font-hud text-xs font-semibold text-[var(--text-primary)] sm:text-base">
                        <TicketsIcon className="h-3.5 w-3.5 shrink-0 text-[var(--warning)]" />
                        <span>{winner.tickets} Megapot Tickets</span>
                      </p>
                      <p className="flex items-center justify-center gap-1.5 font-hud text-xs font-semibold text-[var(--text-secondary)] sm:text-base">
                        <PlanetIcon className="h-3.5 w-3.5 shrink-0 text-violet-300" />
                        <span>1/1 NFT Planet</span>
                      </p>
                    </div>
                    <div className="relative mt-4">
                      <div
                        aria-hidden="true"
                        className={`absolute inset-x-0 -top-3 h-3 [clip-path:polygon(12%_0,88%_0,100%_100%,0_100%)] ${meta.cap}`}
                      />
                      <div
                        aria-hidden="true"
                        className={`flex items-center justify-center border border-t-0 ${meta.base}`}
                      >
                        <span className="font-hud text-3xl font-bold opacity-55 sm:text-5xl">
                          {meta.ordinal}
                        </span>
                      </div>
                    </div>
                  </article>
                </li>
              );
            })}
          </ol>

          <ol
            aria-label="NFT winners"
            start={4}
            className="divide-y divide-[var(--border)] border-t border-[var(--border)]"
          >
            {NFT_WINNERS.map((winner) => (
              <li key={winner.rank}>
                <article
                  aria-label={`${winner.rank}th place`}
                  className="grid min-h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:px-6"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-strong)] font-hud text-sm font-bold text-[var(--text-secondary)]">
                    #{winner.rank}
                  </span>
                  <span
                    className="truncate font-mono text-xs text-[var(--text-primary)] sm:text-sm"
                    title={winner.walletAddress}
                  >
                    {shortAddress(winner.walletAddress)}
                  </span>
                  <span className="flex items-center gap-1.5 font-hud text-sm font-semibold text-[var(--text-primary)] sm:text-base">
                    <PlanetIcon className="h-4 w-4 shrink-0 text-violet-300" />
                    1/1 NFT Planet
                  </span>
                </article>
              </li>
            ))}
          </ol>

          <p className="flex items-center justify-center gap-2 border-t border-[var(--border)] px-4 py-4 text-sm text-[var(--text-secondary)]">
            <PlanetIcon className="h-4 w-4 text-violet-300" />
            Mint page will be live soon
          </p>
        </div>
      </section>

      <section aria-labelledby="snapshot-heading" className="space-y-4">
        <div className="flex flex-col gap-2 border-b border-[var(--border)] pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2
              id="snapshot-heading"
              className="font-hud text-xl font-bold text-[var(--text-primary)]"
            >
              Leaderboard snapshot
            </h2>
            <time
              dateTime={SEASON_ONE_SNAPSHOT_AT}
              className="mt-1 block font-mono text-xs text-[var(--text-secondary)]"
            >
              2026-08-28 23:59 UTC
            </time>
          </div>
          <p className="font-mono text-xs text-[var(--text-secondary)]">48 players</p>
        </div>
        <LeaderboardTable
          rows={SEASON_ONE_LEADERBOARD_ROWS}
          walletAddress={address}
          maximumFractionDigits={0}
          showRate={false}
        />
      </section>
    </div>
  );
}
