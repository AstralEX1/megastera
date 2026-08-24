// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const refreshMocks = vi.hoisted(() => ({ current: vi.fn(), wallet: vi.fn(), mining: vi.fn() }));

const state = vi.hoisted(() => ({
  account: { address: '0x2222222222222222222222222222222222222222' as `0x${string}` | undefined },
  error: undefined as Error | undefined,
  isFetching: false,
  isLoading: false,
  achievements: [
    { id: 'galactic-cartographer', current: 5, tiers: [3, 5, 10] },
    { id: 'mineral-tycoon', current: 600, tiers: [500, 2_500, 25_000] },
  ],
}));

const current = {
  period: { id: '2026-08-12', startsAt: '2026-08-12T00:00:00.000Z', endsAt: '2026-08-13T00:00:00.000Z' },
  asOf: '2026-08-12T12:00:00.000Z',
  total: 2,
  offset: 0,
  limit: 50,
  rows: [
    { rank: 1, walletAddress: '0x1111111111111111111111111111111111111111', scoreMicros: '25000000', effectiveMineralsPerDayMicros: '12000000' },
    { rank: 2, walletAddress: '0x2222222222222222222222222222222222222222', scoreMicros: '19000000', effectiveMineralsPerDayMicros: '8000000' },
  ],
};

vi.mock('wagmi', () => ({ useAccount: () => state.account }));
vi.mock('@/hooks/useLeaderboard', () => ({
  useCurrentLeaderboard: () => ({ data: current, isFetching: state.isFetching, isLoading: state.isLoading, error: state.error, refetch: refreshMocks.current }),
  useWalletLeaderboardPosition: () => ({ data: { period: current.period, asOf: current.asOf, row: current.rows[1], distanceToNextRankMicros: '6000000' }, isLoading: false, refetch: refreshMocks.wallet }),
}));
vi.mock('@/hooks/useWalletMining', () => ({
  useWalletMining: () => ({
    data: state.account.address ? {
      ownerAddress: state.account.address,
      asOf: current.asOf,
      ownedPlanetCount: 2,
      currentBalanceMicros: '19000000',
      effectiveMineralsPerDayMicros: '8000000',
      upgradesEnabled: true,
      galaxyPulse: null,
      achievements: state.achievements,
      planets: [],
    } : undefined,
    isFetching: false,
    refetch: refreshMocks.mining,
  }),
}));

vi.stubGlobal('IntersectionObserver', class {
  observe() {}
  unobserve() {}
  disconnect() {}
});

import { Leaderboard } from './Leaderboard';

describe('Leaderboard', () => {
  beforeEach(() => {
    state.error = undefined;
    state.isFetching = false;
    state.isLoading = false;
    state.account = { address: '0x2222222222222222222222222222222222222222' };
    refreshMocks.current.mockReset().mockResolvedValue({ error: null });
    refreshMocks.wallet.mockReset().mockResolvedValue({ error: null });
    refreshMocks.mining.mockReset().mockResolvedValue({ error: null });
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('shows the FadeArc loading state during the initial standings load', () => {
    state.isLoading = true;

    render(<Leaderboard />);

    expect(screen.getByRole('status', { name: 'Loading leaderboard' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Loading leaderboard' })).toBeInTheDocument();
  });

  it('shows live standings and the connected wallet position', () => {
    const { container } = render(<Leaderboard />);

    expect(screen.getByRole('heading', { name: 'Leaderboard' })).toBeInTheDocument();
    expect(screen.queryByText(/Current lifetime mining/)).not.toBeInTheDocument();
    expect(screen.getByText('Active players').parentElement).toHaveTextContent('2');
    const details = screen.getByRole('complementary', { name: 'Leaderboard details' });
    const seasonOverview = within(details).getByRole('region', { name: 'Season overview' });
    expect(seasonOverview).toHaveTextContent('Megapot Tickets');
    expect(seasonOverview).toHaveTextContent('(USDC)');
    expect(seasonOverview).toHaveTextContent('1/1 NFT Planets');
    expect(seasonOverview.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(2);
    expect(screen.queryByText('LIVE MINERAL SCORE')).not.toBeInTheDocument();
    expect(screen.queryByText('LIVE · GENERATED AT + BASE RATE')).not.toBeInTheDocument();
    expect(screen.queryByText(/As of Aug 12/)).not.toBeInTheDocument();
    expect(screen.getByText(/Last refresh: .* ago/)).toBeInTheDocument();
    expect(container.querySelectorAll('.count-up-text')).toHaveLength(10);
    expect(screen.getByText('Your rank')).toBeInTheDocument();
    expect(screen.getByText(/to next rank/)).toBeInTheDocument();
    expect(screen.queryByRole('progressbar', { name: 'Daily snapshot progress' })).not.toBeInTheDocument();
    expect(container.querySelector('[data-wallet-row="true"]')).toBeInTheDocument();
    expect(container.querySelector('[data-mobile-standings]')).toHaveClass('md:hidden');
  });

  it('places connected-wallet achievements directly below Your rank', async () => {
    const user = userEvent.setup();
    render(<Leaderboard />);

    const details = screen.getByRole('complementary', { name: 'Leaderboard details' });
    const rankCard = within(details).getByText('Your rank').closest('aside');
    const panel = within(details).getByTestId('achievements-panel');
    expect(rankCard?.nextElementSibling).toBe(panel);
    expect(panel).not.toHaveAttribute('open');
    expect(within(panel).getByText('3 / 6 stars')).toBeInTheDocument();

    await user.click(within(panel).getByText('Achievements'));

    expect(panel).toHaveAttribute('open');
    expect(within(panel).getByRole('heading', { name: 'Diversity' })).toBeInTheDocument();
    expect(within(panel).getByText('Galactic Cartographer')).toBeInTheDocument();
    expect(within(panel).getByText('5 / 10')).toBeInTheDocument();
    expect(within(panel).getByLabelText('2 of 3 stars earned')).toBeInTheDocument();
  });

  it('keeps Your rank in normal flow when achievements are expanded', async () => {
    const user = userEvent.setup();
    render(<Leaderboard />);

    const rankCard = screen.getByText('Your rank').closest('aside');
    await user.click(screen.getByText('Achievements'));

    expect(rankCard).not.toHaveClass('lg:sticky');
  });

  it('keeps the season countdown compact and updates it every second', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-20T12:34:56.000Z'));

    render(<Leaderboard />);

    const timer = screen.getByRole('timer', { name: 'Season ends in' });
    expect(timer).toHaveTextContent('08d 11h 24m 04s');

    act(() => vi.advanceTimersByTime(1000));

    expect(timer).toHaveTextContent('08d 11h 24m 03s');
  });

  it('shows the ended state after the season deadline', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-29T00:00:00.000Z'));

    render(<Leaderboard />);

    expect(screen.getByRole('timer', { name: 'Season ends in' })).toHaveTextContent('Season ended');
  });

  it('keeps the public page useful when no wallet is connected', () => {
    state.account = { address: undefined };
    const { container } = render(<Leaderboard />);

    expect(container.querySelectorAll('.count-up-text')).toHaveLength(8);
    expect(screen.queryByText('Your rank')).not.toBeInTheDocument();
    expect(screen.queryByTestId('achievements-panel')).not.toBeInTheDocument();
  });

  it('shows a visible refreshing state while the standings refetches', () => {
    state.isFetching = true;

    render(<Leaderboard />);

    const refreshButton = screen.getByRole('button', { name: 'Refreshing leaderboard' });
    expect(refreshButton).toBeDisabled();
    expect(refreshButton).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Refreshing…')).toBeInTheDocument();
  });

  it('refreshes both standings and wallet data when Refresh is clicked', async () => {
    const user = userEvent.setup();
    let resolveCurrent: ((value: { error: null }) => void) | undefined;
    refreshMocks.current.mockImplementation(() => new Promise((resolve) => {
      resolveCurrent = resolve;
    }));

    render(<Leaderboard />);
    await user.click(screen.getByRole('button', { name: 'Refresh' }));

    expect(await screen.findByRole('button', { name: 'Refreshing leaderboard' })).toBeDisabled();
    expect(refreshMocks.current).toHaveBeenCalledTimes(1);
    expect(refreshMocks.wallet).toHaveBeenCalledTimes(1);
    expect(refreshMocks.mining).toHaveBeenCalledTimes(1);

    resolveCurrent?.({ error: null });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh' })).toBeEnabled());
  });

  it('offers a retryable backend error instead of the placeholder page', () => {
    state.error = new Error('offline');
    render(<Leaderboard />);

    expect(screen.getByRole('heading', { name: 'Leaderboard' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Season overview' })).toBeInTheDocument();
    expect(screen.getByText('Leaderboard unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
