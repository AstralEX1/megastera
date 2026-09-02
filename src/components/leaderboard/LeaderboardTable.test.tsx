// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LeaderboardRow } from '@/hooks/useLeaderboard';
import { LeaderboardTable } from './LeaderboardTable';

vi.stubGlobal(
  'IntersectionObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

const rows = [4, 1, 6, 3, 5, 2].map((rank) => ({
  rank,
  walletAddress: `0x${String(rank).repeat(40)}` as `0x${string}`,
  scoreMicros: `${rank}000000`,
  effectiveMineralsPerDayMicros: `${rank}000000`,
})) satisfies LeaderboardRow[];

describe('LeaderboardTable', () => {
  afterEach(cleanup);

  it('uses the server rank for the same tier treatment on desktop and mobile', () => {
    const { container } = render(
      <LeaderboardTable rows={rows} walletAddress={rows[3].walletAddress} />,
    );

    const expectedTiers = new Map<string, [string, string, string | null]>([
      [
        '1',
        [
          'gold',
          'border-[var(--warning)]',
          'bg-[linear-gradient(90deg,rgba(255,184,77,0.08),transparent)]',
        ],
      ],
      [
        '2',
        [
          'silver',
          'border-[var(--text-secondary)]',
          'bg-[linear-gradient(90deg,rgba(150,154,173,0.06),transparent)]',
        ],
      ],
      [
        '3',
        [
          'bronze',
          'border-[#c58b62]',
          'bg-[linear-gradient(90deg,rgba(197,139,98,0.06),transparent)]',
        ],
      ],
      [
        '4',
        [
          'quiet',
          'border-[var(--border-strong)]',
          'bg-[linear-gradient(90deg,rgba(150,154,173,0.04),transparent)]',
        ],
      ],
      [
        '5',
        [
          'quiet',
          'border-[var(--border-strong)]',
          'bg-[linear-gradient(90deg,rgba(150,154,173,0.04),transparent)]',
        ],
      ],
      ['6', ['ordinary', 'border-transparent', null]],
    ]);

    const desktopRows = [...container.querySelectorAll('tbody tr')] as HTMLElement[];
    const mobileRows = [
      ...container.querySelectorAll('[data-mobile-standings] article'),
    ] as HTMLElement[];

    for (const [rank, [tier, badgeClass, rowClass]] of expectedTiers) {
      const badges = [...container.querySelectorAll(`[data-rank="${rank}"]`)] as HTMLElement[];
      expect(badges).toHaveLength(2);
      badges.forEach((badge) => {
        expect(badge).toHaveAttribute('data-rank-tier', tier);
        expect(badge).toHaveClass(badgeClass);
      });

      for (const rowsForViewport of [desktopRows, mobileRows]) {
        const row = rowsForViewport.find((candidate) =>
          candidate.querySelector(`[data-rank="${rank}"]`),
        );
        expect(row).toBeDefined();
        if (rowClass) {
          expect(row).toHaveClass(rowClass);
        } else {
          expect(row?.className).not.toMatch(/bg-\[linear-gradient/);
        }
        expect(row).toHaveAttribute('data-rank-tier', tier);
      }
    }

    const walletRows = [...container.querySelectorAll('[data-wallet-row="true"]')] as HTMLElement[];
    expect(walletRows).toHaveLength(2);
    walletRows.forEach((row) => {
      expect(row).toHaveClass('bg-violet-500/10');
      expect(row).toHaveClass('bg-[linear-gradient(90deg,rgba(197,139,98,0.06),transparent)]');
      expect(row).toHaveTextContent('You');
    });
  });

  it('shows achievement stars beside the leaderboard score when the snapshot provides them', () => {
    const rowsWithStars = rows.map((row) => ({
      ...row,
      achievementStars: 10 + row.rank,
    }));

    render(<LeaderboardTable rows={rowsWithStars} />);

    expect(screen.getByRole('columnheader', { name: 'Stars' })).toBeInTheDocument();
    expect(screen.getAllByLabelText('11 achievement stars')).toHaveLength(2);
  });
});
