// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useCurrentLeaderboard } from '@/hooks/useLeaderboard';
import { LandingMiningLeaderboard } from './LandingMiningLeaderboard';

vi.mock('@/hooks/useLeaderboard', () => ({
  useCurrentLeaderboard: vi.fn(),
}));

const mockUseCurrentLeaderboard = vi.mocked(useCurrentLeaderboard);

const leaderboardData = {
  period: {
    id: '2026-08-14',
    startsAt: '2026-08-14T00:00:00.000Z',
    endsAt: '2026-08-15T00:00:00.000Z',
  },
  asOf: '2026-08-14T12:00:00.000Z',
  total: 3,
  offset: 0,
  limit: 3,
  rows: [
    {
      rank: 1,
      walletAddress: '0x1111111111111111111111111111111111111111' as `0x${string}`,
      scoreMicros: '125000000',
      effectiveMineralsPerDayMicros: '5000000',
    },
    {
      rank: 2,
      walletAddress: '0x2222222222222222222222222222222222222222' as `0x${string}`,
      scoreMicros: '98000000',
      effectiveMineralsPerDayMicros: '4200000',
    },
    {
      rank: 3,
      walletAddress: '0x3333333333333333333333333333333333333333' as `0x${string}`,
      scoreMicros: '76000000',
      effectiveMineralsPerDayMicros: '3600000',
    },
  ],
};

describe('LandingMiningLeaderboard', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows the mining promise and the live top three leaderboard rows', () => {
    mockUseCurrentLeaderboard.mockReturnValue({
      data: leaderboardData,
      error: null,
      isLoading: false,
    } as ReturnType<typeof useCurrentLeaderboard>);

    render(<LandingMiningLeaderboard />);

    expect(screen.getByRole('region', { name: /Keep mining\.\s*Climb higher\./ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Keep mining\.\s*Climb higher\./ })).toBeInTheDocument();
    expect(screen.getByText(/Your Planet keeps mining minerals/i)).toBeInTheDocument();
    expect(screen.getByText(/Same type bonus: collect 3, 5, or 10 Planets of one type to boost mining by \+5%, \+7\.5%, or \+10%\./i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View leaderboard' })).toHaveAttribute('href', '/leaderboard');
    expect(screen.getByText('LIVE STANDINGS')).toBeInTheDocument();
    expect(screen.getByText('0x1111…1111')).toBeInTheDocument();
    expect(screen.getByText('125')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });
});
