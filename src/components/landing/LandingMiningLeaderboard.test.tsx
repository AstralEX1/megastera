// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useCurrentLeaderboard } from '@/hooks/useLeaderboard';
import { LandingMiningLeaderboard } from './LandingMiningLeaderboard';

vi.mock('@/hooks/useLeaderboard', () => ({
  useCurrentLeaderboard: vi.fn(),
}));

vi.mock('@/components/planets/PlanetGif', () => ({
  PlanetGif: ({ preview }: { preview: { visualTraitsHash: string } }) => (
    <span role="img" aria-label="Generated upgrade Planet" data-visual-seed={preview.visualTraitsHash} />
  ),
}));

const mockUseCurrentLeaderboard = vi.mocked(useCurrentLeaderboard);

const leaderboardData = {
  period: {
    id: '2026-08-14',
    startsAt: '2026-08-14T00:00:00.000Z',
    endsAt: '2026-08-15T00:00:00.000Z',
  },
  asOf: '2026-08-14T12:00:00.000Z',
  total: 5,
  offset: 0,
  limit: 5,
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
    {
      rank: 4,
      walletAddress: '0x4444444444444444444444444444444444444444' as `0x${string}`,
      scoreMicros: '64000000',
      effectiveMineralsPerDayMicros: '3100000',
    },
    {
      rank: 5,
      walletAddress: '0x5555555555555555555555555555555555555555' as `0x${string}`,
      scoreMicros: '52000000',
      effectiveMineralsPerDayMicros: '2800000',
    },
  ],
};

describe('LandingMiningLeaderboard', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows Planet levels, active players, prizes, and a live top five', () => {
    mockUseCurrentLeaderboard.mockReturnValue({
      data: leaderboardData,
      error: null,
      isLoading: false,
    } as ReturnType<typeof useCurrentLeaderboard>);

    render(<LandingMiningLeaderboard />);

    expect(
      screen.getByRole('region', { name: /Keep mining\.\s*Upgrade\.\s*Climb higher\./ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /Keep mining\.\s*Upgrade\.\s*Climb higher\./ }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Spend mined Minerals to upgrade production and climb the leaderboard/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Each upgrade increases your Planet level and mining output/i)).toBeInTheDocument();
    expect(screen.queryByText(/Same type bonus/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('landing-upgrade-preview')).toBeInTheDocument();
    expect(screen.getAllByTestId('landing-upgrade-stage')).toHaveLength(3);
    expect(
      screen.getAllByTestId('landing-upgrade-stage').map((stage) => stage.getAttribute('data-ornament')),
    ).toEqual(['crystal', 'winged', 'crowned']);
    const visualSeeds = screen
      .getAllByTestId('landing-upgrade-stage')
      .map((stage) => stage.getAttribute('data-planet-visual-seed'));
    expect(new Set(visualSeeds).size).toBe(3);
    expect(screen.getAllByText('+10%')).toHaveLength(2);
    expect(screen.getAllByText('+25%')).toHaveLength(2);
    expect(screen.getAllByText('+50%')).toHaveLength(2);
    expect(screen.getByText('UPGRADE IMPACT')).toBeInTheDocument();
    expect(screen.getAllByTestId('landing-upgrade-impact-meter')).toHaveLength(3);
    expect(screen.getByText('LEVEL 1')).toBeInTheDocument();
    expect(screen.getByText('LEVEL 2')).toBeInTheDocument();
    expect(screen.getByText('LEVEL 3')).toBeInTheDocument();
    expect(screen.queryByText(/stage|signal/i)).not.toBeInTheDocument();
    expect(screen.getByText('LIVE STANDINGS')).toBeInTheDocument();
    expect(screen.getByText('ACTIVE PLAYERS')).toBeInTheDocument();
    expect(screen.getByTestId('landing-active-players')).toHaveTextContent('5');
    expect(screen.getByText('Megapot Tickets')).toBeInTheDocument();
    expect(screen.getByText('(USDC)')).toBeInTheDocument();
    expect(screen.getByText('1/1 NFT Planets')).toBeInTheDocument();
    const standings = screen.getByText('LIVE STANDINGS').closest('.landing-mining-standings');
    expect(standings).not.toBeNull();
    expect(standings).toContainElement(screen.getByRole('link', { name: 'View leaderboard' }));
    expect(screen.getByRole('link', { name: 'View leaderboard' })).toHaveAttribute('href', '/leaderboard');
    expect(screen.getByText('0x1111…1111')).toBeInTheDocument();
    expect(screen.getByText('125')).toBeInTheDocument();
    expect(mockUseCurrentLeaderboard).toHaveBeenCalledWith(0, 5);
    expect(screen.getByText('TOP 5')).toBeInTheDocument();
    expect(standings?.querySelectorAll('li')).toHaveLength(5);
  });
});
