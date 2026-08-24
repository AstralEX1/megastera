import type { AchievementProgress } from '@/hooks/useWalletMining';

const ACHIEVEMENTS = [
  {
    id: 'galactic-cartographer',
    category: 'Diversity',
    name: 'Galactic Cartographer',
    tiers: [
      'Collect 3 different planet types.',
      'Collect 5 different planet types.',
      'Collect all 10 planet types.',
    ],
  },
  {
    id: 'rarity-hunter',
    category: 'Rarity',
    name: 'Rarity Hunter',
    tiers: [
      'Discover an Uncommon planet.',
      'Discover an Epic planet.',
      'Discover a Legendary planet.',
    ],
  },
  {
    id: 'type-specialist',
    category: 'Specialization',
    name: 'Type Specialist',
    tiers: [
      'Collect 3 planets of one type.',
      'Collect 5 planets of one type.',
      'Collect 10 planets of one type.',
    ],
  },
  {
    id: 'mineral-tycoon',
    category: 'Mining',
    name: 'Mineral Tycoon',
    tiers: [
      'Mine 500 minerals in total.',
      'Mine 2,500 minerals in total.',
      'Mine 25,000 minerals in total.',
    ],
  },
  {
    id: 'planetary-architect',
    category: 'Upgrades',
    name: 'Planetary Architect',
    tiers: [
      'Upgrade 1 planet to Level 3.',
      'Upgrade 5 planets to Level 3.',
      'Upgrade 10 planets to Level 3.',
    ],
  },
  {
    id: 'planetary-empire',
    category: 'Fleet Size',
    name: 'Planetary Empire',
    tiers: ['Collect 5 planets.', 'Collect 10 planets.', 'Collect 25 planets.'],
  },
] as const;

function AchievementRow({ achievement }: { achievement: AchievementProgress }) {
  const copy = ACHIEVEMENTS.find(({ id }) => id === achievement.id);
  if (!copy) return null;

  const completedTiers = achievement.tiers.filter((target) => achievement.current >= target).length;
  const target = achievement.tiers[completedTiers] ?? achievement.tiers.at(-1) ?? 1;
  const description = copy.tiers[completedTiers] ?? 'All tiers complete.';

  return (
    <section className="grid gap-1.5 px-4 py-3">
      <h3 className="pt-0.5 font-hud text-xs font-semibold text-[var(--text-secondary)]">
        {copy.category}
      </h3>
      <article className="min-w-0">
        <div className="flex items-center justify-between gap-3">
          <h4 className="min-w-0 font-hud text-sm font-semibold text-[var(--text-primary)]">
            {copy.name}
          </h4>
          <div
            role="img"
            aria-label={`${completedTiers} of ${achievement.tiers.length} stars earned`}
            className="flex shrink-0 gap-1 font-mono text-sm"
          >
            {achievement.tiers.map((tier, index) => (
              <span
                key={tier}
                aria-hidden="true"
                className={index < completedTiers ? 'text-amber-300' : 'text-[var(--text-muted)]'}
              >
                {index < completedTiers ? '★' : '☆'}
              </span>
            ))}
          </div>
        </div>
        <div className="mt-1 flex items-baseline justify-between gap-3">
          <p className="min-w-0 text-xs leading-5 text-[var(--text-secondary)]">{description}</p>
          <span className="shrink-0 font-mono text-xs tabular-nums text-[var(--text-secondary)]">
            {Math.min(achievement.current, target).toLocaleString('en-US')} /{' '}
            {target.toLocaleString('en-US')}
          </span>
        </div>
      </article>
    </section>
  );
}

export function AchievementsPanel({ achievements }: { achievements: AchievementProgress[] }) {
  const earnedStars = achievements.reduce(
    (total, achievement) =>
      total + achievement.tiers.filter((target) => achievement.current >= target).length,
    0,
  );
  const totalStars = achievements.reduce(
    (total, achievement) => total + achievement.tiers.length,
    0,
  );

  return (
    <details
      data-testid="achievements-panel"
      className="group w-full max-w-3xl overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-raised)]"
    >
      <summary className="cursor-pointer list-none px-4 py-3 transition-colors hover:bg-[var(--surface-hover)] [&::-webkit-details-marker]:hidden">
        <div className="flex items-center gap-3">
          <h2 className="min-w-0 flex-1 font-hud text-base font-bold text-[var(--text-primary)]">
            Achievements
          </h2>
          <span className="font-mono text-xs tabular-nums text-[var(--text-secondary)]">
            {earnedStars} / {totalStars} stars
          </span>
          <span
            aria-hidden="true"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[var(--border-strong)] font-mono text-base text-[var(--text-secondary)] transition-transform group-open:rotate-45"
          >
            +
          </span>
        </div>
      </summary>

      <div className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
        {achievements.map((achievement) => (
          <AchievementRow key={achievement.id} achievement={achievement} />
        ))}
      </div>
    </details>
  );
}
