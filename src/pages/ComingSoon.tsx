import { SpotlightCard } from '@/components/common/SpotlightCard';

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

function RoadmapList({ items, muted = false }: { items: readonly string[]; muted?: boolean }) {
  return (
    <ul className={`mt-5 space-y-3 text-sm ${muted ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)]'}`}>
      {items.map((item) => (
        <li key={item} className="flex gap-3 leading-6">
          <span aria-hidden="true" className="mt-[0.68rem] h-1 w-1 shrink-0 rounded-full bg-current opacity-60" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function TimelineNode({ children, tone = 'future' }: { children: string; tone?: 'done' | 'current' | 'future' }) {
  const toneClass = tone === 'done'
    ? 'border-[var(--success)]/50 bg-[var(--surface)] text-[var(--success)]'
    : tone === 'current'
      ? 'border-[var(--accent)] bg-[var(--accent)] text-[#080910] shadow-[0_0_22px_rgba(174,185,255,0.28)]'
      : 'border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text-secondary)]';

  return (
    <div className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border font-mono text-xs font-bold ${toneClass}`}>
      {children}
    </div>
  );
}

function OrbitalMark() {
  return (
    <div aria-hidden="true" className="relative h-28 w-28 shrink-0 opacity-75">
      <div className="absolute inset-2 rounded-full border border-[var(--accent)]/20" />
      <div className="absolute inset-6 rotate-45 rounded-full border border-[var(--rare)]/25" />
      <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--text-primary)] shadow-[0_0_18px_rgba(244,247,255,0.5)]" />
      <div className="absolute right-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-[var(--accent)]" />
      <div className="absolute bottom-4 left-5 h-1.5 w-1.5 rounded-full bg-[var(--rare)]" />
    </div>
  );
}

function ShipMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 180 120" className="h-28 w-40 text-[var(--accent)] opacity-[0.12]">
      <path d="M90 8 115 48l48 20-48 11-25 33-25-33-48-11 48-20L90 8Z" fill="currentColor" />
      <path d="m90 31 11 35-11 26-11-26 11-35Z" fill="var(--background)" opacity=".75" />
    </svg>
  );
}

export function ComingSoon() {
  return (
    <div className="mx-auto max-w-4xl pb-10">
      <header className="border-b border-[var(--border)] pb-6">
        <span className="telemetry text-[var(--accent)]">Coming Soon</span>
        <h1 className="mt-3 font-hud text-4xl font-bold tracking-[-0.05em] text-[var(--text-primary)] sm:text-5xl">
          Roadmap
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-secondary)] sm:text-base">
          The Megastera universe is expanding season by season.
        </p>
      </header>

      <div className="relative mt-8">
        <div aria-hidden="true" className="absolute bottom-10 left-[15px] top-4 w-px bg-gradient-to-b from-[var(--success)]/50 via-[var(--accent)]/45 to-[var(--border)]" />

        <section className="relative grid grid-cols-[32px_minmax(0,1fr)] gap-5 pb-10">
          <TimelineNode tone="done">✓</TimelineNode>
          <div className="pt-0.5 opacity-70">
            <span className="telemetry text-[var(--success)]">Genesis</span>
            <h2 className="mt-2 font-hud text-xl font-semibold text-[var(--text-primary)]">Genesis</h2>
            <RoadmapList items={genesis} muted />
          </div>
        </section>

        <section className="relative grid grid-cols-[32px_minmax(0,1fr)] gap-5 pb-10" data-roadmap-current="true">
          <TimelineNode tone="current">◆</TimelineNode>
          <SpotlightCard className="rounded-2xl border border-[var(--accent)]/75 bg-[linear-gradient(145deg,rgba(174,185,255,0.08),rgba(9,10,18,0.92)_48%)] p-5 shadow-[0_0_40px_rgba(174,185,255,0.08)] sm:p-6">
            <span className="telemetry text-[var(--accent)]">Next Release</span>
            <h2 className="mt-2 font-hud text-2xl font-bold tracking-[-0.035em] text-[var(--text-primary)]">
              Mid-Season 1 Update
            </h2>
            <RoadmapList items={midSeason} />
          </SpotlightCard>
        </section>

        <section className="relative grid grid-cols-[32px_minmax(0,1fr)] gap-5 pb-12">
          <TimelineNode tone="future">01</TimelineNode>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
            <span className="telemetry text-[var(--text-secondary)]">Season 1</span>
            <h2 className="mt-2 font-hud text-2xl font-semibold tracking-[-0.035em] text-[var(--text-primary)]">
              Season 1 Finale
            </h2>
            <RoadmapList items={finale} muted />
          </div>
        </section>

        <section className="relative grid grid-cols-[32px_minmax(0,1fr)] gap-5 pb-12">
          <TimelineNode tone="future">02</TimelineNode>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <span className="telemetry text-[var(--rare)]">Season 2</span>
                <h2 className="mt-2 font-hud text-2xl font-semibold tracking-[-0.035em] text-[var(--text-primary)]">
                  Stellar Expansion
                </h2>
                <RoadmapList items={stellarExpansion} muted />
              </div>
              <OrbitalMark />
            </div>

            <details className="group relative mt-6 border-t border-[var(--border)] pt-4">
              <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-lg text-xs font-semibold uppercase tracking-[0.1em] text-[var(--accent)] outline-none transition-colors hover:text-[var(--text-primary)] focus-visible:text-[var(--text-primary)]">
                <span aria-hidden="true" className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[var(--accent)]/40 bg-[var(--accent)]/5">◈</span>
                Season 1 Legacy
              </summary>
              <div className="mt-3 max-w-xl rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-4 text-sm leading-6 text-[var(--text-secondary)] opacity-90 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 group-open:opacity-100 motion-reduce:transition-none">
                Season 1 assets will carry forward into Season 2 and play a crucial role in the new Stellar Expansion mechanics.
              </div>
            </details>
          </div>
        </section>

        <section className="relative grid grid-cols-[32px_minmax(0,1fr)] gap-5">
          <TimelineNode tone="future">03</TimelineNode>
          <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[linear-gradient(145deg,var(--surface),rgba(9,10,18,0.55))] p-5 opacity-80 sm:p-6">
            <div className="pointer-events-none absolute right-2 top-4 hidden sm:block">
              <ShipMark />
            </div>
            <div className="relative z-10 max-w-xl">
              <span className="telemetry text-[var(--text-secondary)]">Season 3</span>
              <h2 className="mt-2 font-hud text-2xl font-semibold tracking-[-0.035em] text-[var(--text-primary)]">
                Galactic Conflict
              </h2>
              <RoadmapList items={galacticConflict} muted />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
