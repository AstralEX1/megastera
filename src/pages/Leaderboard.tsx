import { motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { useAccount } from 'wagmi';
import { PlanetIcon, TicketsIcon } from '@/components/icons/TicketsIcon';
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable';
import { SEASON_ONE_LEADERBOARD_ROWS, SEASON_ONE_SNAPSHOT_AT } from '@/data/seasonOneLeaderboard';

const PODIUM_WINNERS = [
  {
    rank: 1,
    tickets: 18,
    walletAddress: SEASON_ONE_LEADERBOARD_ROWS[0].walletAddress,
    planetImage: '/images/season-1/winner-planet-1.png',
  },
  {
    rank: 2,
    tickets: 12,
    walletAddress: SEASON_ONE_LEADERBOARD_ROWS[1].walletAddress,
    planetImage: '/images/season-1/winner-planet-2.png',
  },
  {
    rank: 3,
    tickets: 6,
    walletAddress: SEASON_ONE_LEADERBOARD_ROWS[2].walletAddress,
    planetImage: '/images/season-1/winner-planet-3.png',
  },
] as const;

const NFT_WINNERS = [
  {
    rank: 4,
    walletAddress: SEASON_ONE_LEADERBOARD_ROWS[3].walletAddress,
    planetImage: '/images/season-1/winner-planet-4.png',
  },
  {
    rank: 5,
    walletAddress: SEASON_ONE_LEADERBOARD_ROWS[4].walletAddress,
    planetImage: '/images/season-1/winner-planet-5.png',
  },
] as const;

type PodiumRank = (typeof PODIUM_WINNERS)[number]['rank'];

const PODIUM_POSITION: Record<PodiumRank, number> = { 1: 0, 2: -1, 3: 1 };

const PODIUM_META = {
  1: {
    ordinal: '1st',
    placement:
      'col-span-2 row-start-1 mx-auto w-full max-w-72 sm:col-span-1 sm:col-start-2 sm:max-w-none',
    medal: 'h-20 w-20 border-[#e1b94f] bg-[rgba(225,185,79,0.08)] text-[#e1b94f]',
    badge: 'border-[#e1b94f] bg-[#e1b94f] text-[#171309]',
    cap: 'bg-[#8f7531]',
    base: 'h-28 border-[#d8b45a]/60 bg-[linear-gradient(180deg,rgba(213,174,74,0.78),rgba(86,68,24,0.42))] text-[#f0ce72] sm:h-36',
    spotlight:
      'bg-[linear-gradient(180deg,rgba(245,217,131,0.36)_0%,rgba(213,173,70,0.13)_58%,transparent_100%)]',
    revealDelay: 0.07,
  },
  2: {
    ordinal: '2nd',
    placement: 'col-start-1 row-start-2 sm:col-start-1 sm:row-start-1',
    medal: 'h-16 w-16 border-[#a6adba] bg-[rgba(166,173,186,0.08)] text-[#c5cad3]',
    badge: 'border-[#a6adba] bg-[#a6adba] text-[#12151b]',
    cap: 'bg-[#656c78]',
    base: 'h-20 border-[#a6adba]/50 bg-[linear-gradient(180deg,rgba(154,162,175,0.72),rgba(51,57,68,0.38))] text-[#d7dbe2] sm:h-24',
    spotlight:
      'bg-[linear-gradient(180deg,rgba(215,219,226,0.3)_0%,rgba(154,162,175,0.1)_58%,transparent_100%)]',
    revealDelay: 0,
  },
  3: {
    ordinal: '3rd',
    placement: 'col-start-2 row-start-2 sm:col-start-3 sm:row-start-1',
    medal: 'h-16 w-16 border-[#b77b52] bg-[rgba(183,123,82,0.08)] text-[#d29a73]',
    badge: 'border-[#b77b52] bg-[#b77b52] text-[#180f0a]',
    cap: 'bg-[#744b34]',
    base: 'h-16 border-[#b77b52]/50 bg-[linear-gradient(180deg,rgba(164,106,69,0.66),rgba(65,43,31,0.38))] text-[#d3a07a] sm:h-20',
    spotlight:
      'bg-[linear-gradient(180deg,rgba(216,162,124,0.3)_0%,rgba(164,106,69,0.1)_58%,transparent_100%)]',
    revealDelay: 0.14,
  },
} as const;

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function Leaderboard() {
  const { address } = useAccount();
  const reduceMotion = useReducedMotion();
  const [hoveredPodiumRank, setHoveredPodiumRank] = useState<PodiumRank | null>(null);
  const [focusedPodiumRank, setFocusedPodiumRank] = useState<PodiumRank | null>(null);
  const activePodiumRank = hoveredPodiumRank ?? focusedPodiumRank;

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
              const podiumState =
                activePodiumRank === null
                  ? 'rest'
                  : activePodiumRank === winner.rank
                    ? 'active'
                    : 'dimmed';
              const positionDelta =
                activePodiumRank === null
                  ? 0
                  : PODIUM_POSITION[winner.rank] - PODIUM_POSITION[activePodiumRank];
              const active = podiumState === 'active';
              return (
                <motion.li
                  key={winner.rank}
                  animate={
                    reduceMotion
                      ? { opacity: podiumState === 'dimmed' ? 0.55 : 1 }
                      : {
                          opacity: podiumState === 'dimmed' ? 0.5 : 1,
                          x: podiumState === 'dimmed' ? positionDelta * 12 : 0,
                          y: active ? -10 : 0,
                          scale: active ? 1.025 : 1,
                        }
                  }
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : { type: 'spring', stiffness: 260, damping: 24, mass: 0.8 }
                  }
                  className={meta.placement}
                >
                  <motion.article
                    aria-label={`${meta.ordinal} place`}
                    data-podium-state={podiumState}
                    tabIndex={0}
                    initial={reduceMotion ? false : { opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={
                      reduceMotion
                        ? { duration: 0 }
                        : {
                            duration: 0.45,
                            delay: meta.revealDelay,
                            ease: [0.16, 1, 0.3, 1],
                          }
                    }
                    onPointerEnter={() => setHoveredPodiumRank(winner.rank)}
                    onPointerLeave={() => setHoveredPodiumRank(null)}
                    onFocus={() => setFocusedPodiumRank(winner.rank)}
                    onBlur={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                        setFocusedPodiumRank(null);
                      }
                    }}
                    className="relative isolate flex min-w-0 flex-col rounded-lg text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--warning)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#090a12]"
                  >
                    <motion.div
                      aria-hidden="true"
                      initial={false}
                      animate={{ opacity: active ? 1 : 0 }}
                      transition={reduceMotion ? { duration: 0 } : { duration: 0.2 }}
                      className={`pointer-events-none absolute -inset-x-4 -top-7 bottom-0 -z-10 [clip-path:polygon(40%_0,60%_0,98%_100%,2%_100%)] ${meta.spotlight}`}
                    />
                    <div className="relative z-[1] flex min-w-0 flex-col">
                      <div
                        className={`relative mx-auto flex shrink-0 items-center justify-center overflow-visible rounded-full border-2 motion-safe:transition-[filter] motion-safe:duration-200 ${meta.medal} ${active ? 'motion-safe:brightness-110 motion-safe:saturate-[1.08]' : ''}`}
                      >
                        <span className="absolute inset-0 overflow-hidden rounded-full">
                          <img
                            src={winner.planetImage}
                            alt={`${meta.ordinal} place prize Planet`}
                            width={96}
                            height={96}
                            decoding="async"
                            className="h-full w-full object-cover"
                          />
                        </span>
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
                    </div>
                  </motion.article>
                </motion.li>
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
                <motion.article
                  aria-label={`${winner.rank}th place`}
                  tabIndex={0}
                  whileHover={reduceMotion ? undefined : { x: 4 }}
                  whileFocus={reduceMotion ? undefined : { x: 4 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 26 }}
                  className="grid min-h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:px-6"
                >
                  <span className="relative h-11 w-11 shrink-0">
                    <img
                      src={winner.planetImage}
                      alt={`${winner.rank}th place prize Planet`}
                      width={44}
                      height={44}
                      loading="lazy"
                      decoding="async"
                      className="h-11 w-11 rounded-full border border-[var(--border-strong)] object-cover"
                    />
                    <span className="absolute -right-1.5 -top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--surface-raised)] px-1 font-hud text-[10px] font-bold text-[var(--text-secondary)]">
                      #{winner.rank}
                    </span>
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
                </motion.article>
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
