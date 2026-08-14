// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render } from '@testing-library/react';
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

function makeRows(count: number): LeaderboardRow[] {
  return Array.from({ length: count }, (_, index) => ({
    rank: index + 1,
    walletAddress: `0x${String(index + 1).padStart(40, '0')}` as `0x${string}`,
    scoreMicros: '1000000',
    effectiveMineralsPerDayMicros: '100000',
  }));
}

describe('LeaderboardTable', () => {
  afterEach(cleanup);

  it('marks podium and remaining prize places in both responsive views', () => {
    const { container } = render(<LeaderboardTable rows={makeRows(11)} />);

    expect(container.querySelectorAll('[data-rank-tier="gold"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-rank-tier="silver"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-rank-tier="bronze"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-rank-tier="top-ten"]')).toHaveLength(14);
    expect(container.querySelectorAll('[data-rank-tier="standard"]')).toHaveLength(2);
  });
});
