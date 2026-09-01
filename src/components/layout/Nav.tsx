import type { ReactNode } from 'react';
import { PlanetsIcon } from '@/components/icons/PlanetsIcon';
import { PlayIcon } from '@/components/icons/PlayIcon';

export type NavKey = 'home' | 'play' | 'tickets' | 'planets' | 'history' | 'lab' | 'comingSoon';

const ComingSoonIcon = (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none">
    <path
      d="M12 2.8l1.45 5.75L19.2 10l-5.75 1.45L12 17.2l-1.45-5.75L4.8 10l5.75-1.45L12 2.8Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <path d="M18.2 15.4l.7 2.7 2.7.7-2.7.7-.7 2.7-.7-2.7-2.7-.7 2.7-.7.7-2.7Z" fill="currentColor" opacity=".7" />
  </svg>
);

const ITEMS: { key: NavKey; label: string; icon: ReactNode }[] = [
  { key: 'play', label: 'Play', icon: <PlayIcon /> },
  { key: 'planets', label: 'My planets', icon: <PlanetsIcon /> },
  { key: 'history', label: 'Leaderboard', icon: <PlanetsIcon /> },
  { key: 'comingSoon', label: 'Season 1 Finale', icon: ComingSoonIcon },
];

type NavProps = { active: NavKey; onSelect: (k: NavKey) => void };

export function Nav({ active, onSelect }: NavProps) {
  return (
    <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
      {ITEMS.map((i) => {
        const isActive = active === i.key;
        return (
          <button
            key={i.key}
            type="button"
            onClick={() => onSelect(i.key)}
            aria-current={isActive ? 'page' : undefined}
            className={
              'rounded-lg px-3 py-2 font-hud text-sm font-medium uppercase tracking-wide transition-colors ' +
              (isActive
                ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]')
            }
          >
            {i.label}
          </button>
        );
      })}
    </nav>
  );
}

export function MobileBottomNav({ active, onSelect }: NavProps) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-[var(--border)] bg-[var(--background)] md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Primary"
    >
      {ITEMS.map((i) => {
        const isActive = active === i.key;
        return (
          <button
            key={i.key}
            type="button"
            onClick={() => onSelect(i.key)}
            aria-current={isActive ? 'page' : undefined}
            className={
              'relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[12px] font-medium transition-colors ' +
              'active:bg-[var(--surface-hover)] ' +
              (isActive
                ? 'text-[var(--primary)] ' +
                  'before:absolute before:top-0 before:left-1/2 before:h-0.5 before:w-8 before:-translate-x-1/2 before:bg-[var(--primary)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]')
            }
          >
            {i.icon}
            <span>{i.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
