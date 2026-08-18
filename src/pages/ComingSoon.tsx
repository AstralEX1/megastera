import { motion, useReducedMotion } from 'motion/react';
import { useLayoutEffect, useRef, useState, type Ref } from 'react';
import { SpotlightCard } from '@/components/common/SpotlightCard';
import { BlurText } from '@/components/common/reactBits/BlurText';
import { DecryptedText } from '@/components/common/reactBits/DecryptedText';
import { FadeContent } from '@/components/common/reactBits/FadeContent';
import { Galaxy } from '@/components/common/reactBits/Galaxy';

const genesis = [
  'Megastera Launch',
  'Initial Player Acquisition',
  'Season 1 Begins',
] as const;

const midSeason = [
  'Minerals Become an In-Game Currency',
  'Planet Upgrades',
  'Mineral Rewards Based on Ticket Results',
] as const;

const finale = [
  'Final Leaderboard Snapshot',
  'USDC Rewards for Top Players',
  'Unique 1/1 NFT Planets for the Top 10',
] as const;

const stellarExpansion = [
  'Stars as a New Game Asset',
  'Stellar Systems',
  'New Gameplay Mechanics',
] as const;

const galacticConflict = [
  'PvP Gameplay',
  'Attack and Defend Stellar Systems',
  'Starships',
  'Captains',
  'Fleet-Based Mechanics',
  'Expanded Gameplay Built Around Player Competition',
] as const;

type RoadmapListProps = {
  items: readonly string[];
  muted?: boolean;
  completed?: boolean;
};

function RoadmapList({ items, muted = false, completed = false }: RoadmapListProps) {
  const reduceMotion = useReducedMotion();

  return (
    <ul className={`mt-5 space-y-3 text-sm ${muted ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)]'}`}>
      {items.map((item, index) => (
        <li
          key={item}
          className="flex gap-3 leading-6"
          data-roadmap-completed-item={completed ? 'true' : undefined}
        >
          {completed ? (
            <motion.span
              aria-hidden="true"
              className="mt-[0.18rem] inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--success)]/35 bg-[var(--success)]/5 font-mono text-[11px] font-bold text-[var(--success)]"
              initial={reduceMotion ? false : { opacity: 0.25, scale: 0.72 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                duration: reduceMotion ? 0 : 0.24,
                delay: reduceMotion ? 0 : 0.18 + index * 0.08,
                ease: 'easeOut',
              }}
            >
              ✓
            </motion.span>
          ) : (
            <span aria-hidden="true" className="mt-[0.68rem] h-1 w-1 shrink-0 rounded-full bg-current opacity-60" />
          )}
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function TimelineNode({
  children,
  tone = 'future',
  nodeRef,
}: {
  children: string;
  tone?: 'done' | 'current' | 'future';
  nodeRef?: Ref<HTMLDivElement>;
}) {
  const toneClass = tone === 'done'
    ? 'border-[var(--success)]/50 bg-[var(--surface)] text-[var(--success)]'
    : tone === 'current'
      ? 'border-[var(--accent)] bg-[var(--accent)] text-[#080910] shadow-[0_0_22px_rgba(174,185,255,0.28)]'
      : 'border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text-secondary)]';

  return (
    <div
      ref={nodeRef}
      className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border font-mono text-xs font-bold ${toneClass}`}
    >
      {children}
    </div>
  );
}

export function ComingSoon() {
  const timelineRef = useRef<HTMLDivElement>(null);
  const currentNodeRef = useRef<HTMLDivElement>(null);
  const [progressHeight, setProgressHeight] = useState(0);
  const reduceMotion = useReducedMotion();

  useLayoutEffect(() => {
    const timeline = timelineRef.current;
    const currentNode = currentNodeRef.current;
    if (!timeline || !currentNode) return;

    const updateProgress = () => {
      const timelineRect = timeline.getBoundingClientRect();
      const currentRect = currentNode.getBoundingClientRect();
      const currentCenter = currentRect.top - timelineRect.top + currentRect.height / 2;
      setProgressHeight(Math.max(0, currentCenter - 16));
    };

    updateProgress();
    window.addEventListener('resize', updateProgress);

    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateProgress);
    resizeObserver?.observe(timeline);
    resizeObserver?.observe(currentNode);

    return () => {
      window.removeEventListener('resize', updateProgress);
      resizeObserver?.disconnect();
    };
  }, []);

  return (
    <div className="relative isolate mx-auto max-w-4xl pb-10">
      <div className="pointer-events-none absolute bottom-[-2.5rem] left-1/2 top-[-2.5rem] z-0 w-screen -translate-x-1/2 overflow-hidden">
        <Galaxy density={0.42} glowIntensity={0.16} speed={0.18} />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(3,3,7,0.58),rgba(3,3,7,0.24)_24%,rgba(3,3,7,0.34)_70%,rgba(3,3,7,0.76))]"
        />
      </div>

      <div className="relative z-10">
        <header className="border-b border-[var(--border)] pb-6">
          <span className="telemetry text-[var(--accent)]">
            <DecryptedText
              text="Coming Soon"
              className="text-[var(--accent)]"
              encryptedClassName="text-[var(--text-secondary)]"
            />
          </span>
          <h1 className="mt-3 font-hud text-4xl font-bold tracking-[-0.05em] text-[var(--text-primary)] sm:text-5xl">
            <BlurText text="Roadmap" delay={52} />
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-secondary)] sm:text-base">
            The Megastera universe is expanding season by season.
          </p>
        </header>

        <div ref={timelineRef} className="relative mt-8">
          <div aria-hidden="true" className="absolute bottom-4 left-[15px] top-4 w-px bg-[var(--border)]" />
          <motion.div
            aria-hidden="true"
            data-roadmap-progress="true"
            className="absolute left-[15px] top-4 z-[1] w-px bg-gradient-to-b from-[var(--success)] via-[var(--success)]/70 to-[var(--accent)] shadow-[0_0_12px_rgba(80,210,160,0.12)]"
            initial={reduceMotion ? false : { height: 0, opacity: 0.35 }}
            animate={{ height: progressHeight, opacity: 1 }}
            transition={{ duration: reduceMotion ? 0 : 0.9, ease: 'easeOut' }}
          />

          <FadeContent duration={0.45}>
            <section className="relative grid grid-cols-[32px_minmax(0,1fr)] gap-5 pb-10">
              <TimelineNode tone="done">✓</TimelineNode>
              <div className="pt-0.5">
                <span className="telemetry text-[var(--success)]">Completed</span>
                <h2 className="mt-2 font-hud text-xl font-semibold text-[var(--text-primary)]">Genesis</h2>
                <RoadmapList items={genesis} muted completed />
              </div>
            </section>
          </FadeContent>

          <FadeContent delay={0.03} duration={0.5}>
            <section className="relative grid grid-cols-[32px_minmax(0,1fr)] gap-5 pb-10" data-roadmap-current="true">
              <TimelineNode tone="current" nodeRef={currentNodeRef}>◆</TimelineNode>
              <SpotlightCard className="rounded-2xl border border-[var(--accent)]/75 bg-[linear-gradient(145deg,rgba(174,185,255,0.08),rgba(9,10,18,0.92)_48%)] p-5 shadow-[0_0_40px_rgba(174,185,255,0.08)] sm:p-6">
                <span className="telemetry text-[var(--accent)]">Next Update</span>
                <h2 className="mt-2 font-hud text-2xl font-bold tracking-[-0.035em] text-[var(--text-primary)]">
                  Mid-Season 1 Update
                </h2>
                <RoadmapList items={midSeason} />
              </SpotlightCard>
            </section>
          </FadeContent>

          <FadeContent duration={0.52}>
            <section className="relative grid grid-cols-[32px_minmax(0,1fr)] gap-5 pb-10">
              <TimelineNode tone="future">01</TimelineNode>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/95 p-5 backdrop-blur-[2px] sm:p-6">
                <span className="telemetry text-[var(--text-secondary)]">Season 1</span>
                <h2 className="mt-2 font-hud text-2xl font-semibold tracking-[-0.035em] text-[var(--text-primary)]">
                  Season 1 Finale
                </h2>
                <RoadmapList items={finale} muted />
              </div>
            </section>
          </FadeContent>

          <FadeContent duration={0.52}>
            <section className="relative grid grid-cols-[32px_minmax(0,1fr)] gap-5 pb-10">
              <TimelineNode tone="future">02</TimelineNode>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/95 p-5 backdrop-blur-[2px] sm:p-6">
                <span className="telemetry text-[var(--rare)]">Season 2</span>
                <h2 className="mt-2 font-hud text-2xl font-semibold tracking-[-0.035em] text-[var(--text-primary)]">
                  Stellar Expansion
                </h2>
                <RoadmapList items={stellarExpansion} muted />

                <details className="group relative mt-6 border-t border-[var(--border)] pt-4">
                  <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-lg text-xs font-semibold uppercase tracking-[0.1em] text-[var(--accent)] outline-none transition-colors hover:text-[var(--text-primary)] focus-visible:text-[var(--text-primary)]">
                    <motion.span
                      aria-hidden="true"
                      className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[var(--accent)]/40 bg-[var(--accent)]/5"
                      animate={
                        reduceMotion
                          ? undefined
                          : {
                              opacity: [0.68, 1, 0.68],
                              boxShadow: [
                                '0 0 0 rgba(174,185,255,0)',
                                '0 0 14px rgba(174,185,255,0.18)',
                                '0 0 0 rgba(174,185,255,0)',
                              ],
                            }
                      }
                      transition={reduceMotion ? undefined : { duration: 1.5, repeat: Infinity, repeatDelay: 3.4 }}
                    >
                      ◈
                    </motion.span>
                    Season 1 Legacy
                  </summary>
                  <div className="mt-3 max-w-xl rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-4 text-sm leading-6 text-[var(--text-secondary)] opacity-90 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 group-open:opacity-100 motion-reduce:transition-none">
                    Season 1 assets will carry forward into Season 2 and play a crucial role in the new Stellar Expansion mechanics.
                  </div>
                </details>
              </div>
            </section>
          </FadeContent>

          <FadeContent duration={0.52}>
            <section className="relative grid grid-cols-[32px_minmax(0,1fr)] gap-5">
              <TimelineNode tone="future">03</TimelineNode>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/95 p-5 backdrop-blur-[2px] sm:p-6">
                <span className="telemetry text-[var(--text-secondary)]">Season 3</span>
                <h2 className="mt-2 font-hud text-2xl font-semibold tracking-[-0.035em] text-[var(--text-primary)]">
                  Galactic Conflict
                </h2>
                <RoadmapList items={galacticConflict} muted />
              </div>
            </section>
          </FadeContent>
        </div>
      </div>
    </div>
  );
}
