// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import userEvent from '@testing-library/user-event';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const refreshMocks = vi.hoisted(() => ({ current: vi.fn(), wallet: vi.fn() }));

const state = vi.hoisted(() => ({
  account: { address: '0x2222222222222222222222222222222222222222' as `0x${string}` | undefined },
  error: undefined as Error | undefined,
  isFetching: false,
  isLoading: false,
}));

const current = {
  period: {
    id: '2026-08-12',
    startsAt: '2026-08-12T00:00:00.000Z',
    endsAt: '2026-08-13T00:00:00.000Z',
  },
  asOf: '2026-08-12T12:00:00.000Z',
  total: 2,
  offset: 0,
  limit: 50,
  rows: [
    {
      rank: 1,
      walletAddress: '0x1111111111111111111111111111111111111111',
      scoreMicros: '25000000',
      effectiveMineralsPerDayMicros: '12000000',
    },
    {
      rank: 2,
      walletAddress: '0x2222222222222222222222222222222222222222',
      scoreMicros: '19000000',
      effectiveMineralsPerDayMicros: '8000000',
    },
  ],
};

vi.mock('wagmi', () => ({ useAccount: () => state.account }));
vi.mock('@/hooks/useLeaderboard', () => ({
  useCurrentLeaderboard: () => ({
    data: current,
    isFetching: state.isFetching,
    isLoading: state.isLoading,
    error: state.error,
    refetch: refreshMocks.current,
  }),
  useWalletLeaderboardPosition: () => ({
    data: {
      period: current.period,
      asOf: current.asOf,
      row: current.rows[1],
      distanceToNextRankMicros: '6000000',
    },
    isLoading: false,
    refetch: refreshMocks.wallet,
  }),
}));

vi.stubGlobal(
  'IntersectionObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

import { Leaderboard } from './Leaderboard';

describe('Leaderboard', () => {
  beforeEach(() => {
    state.error = undefined;
    state.isFetching = false;
    state.isLoading = false;
    state.account = { address: '0x2222222222222222222222222222222222222222' };
    refreshMocks.current.mockReset().mockResolvedValue({ error: null });
    refreshMocks.wallet.mockReset().mockResolvedValue({ error: null });
  });
  afterEach(cleanup);

  it('shows the FadeArc loading state during the initial standings load', () => {
    state.isLoading = true;

    render(<Leaderboard />);

    expect(screen.getByRole('status', { name: 'Loading leaderboard' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Loading leaderboard' })).toBeInTheDocument();
  });

  it('shows live standings and the connected wallet position', () => {
    const { container } = render(<Leaderboard />);

    expect(screen.getByRole('heading', { name: 'Leaderboard' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Season 1' })).toBeInTheDocument();
    expect(screen.queryByText('Final standings close August 23, 2026')).not.toBeInTheDocument();
    expect(screen.getByText('August 23, 2026, 23:39 UTC')).toBeInTheDocument();
    expect(screen.getByRole('timer')).toBeInTheDocument();
    expect(screen.getByText('PRIZES')).toBeInTheDocument();
    expect(screen.getByText('TOP 10 RECEIVE')).toBeInTheDocument();
    expect(screen.getByText('USDC')).toBeInTheDocument();
    expect(screen.getByText('1/1 Planet NFT')).toBeInTheDocument();
    expect(screen.queryByText('LIVE MINERAL SCORE')).not.toBeInTheDocument();
    expect(screen.queryByText('LIVE · GENERATED AT + BASE RATE')).not.toBeInTheDocument();
    expect(screen.queryByText(/As of Aug 12/)).not.toBeInTheDocument();
    expect(screen.getByText(/Last refresh: .* ago/)).toBeInTheDocument();
    expect(container.querySelectorAll('.count-up-text')).toHaveLength(10);
    expect(screen.getByText('Your rank')).toBeInTheDocument();
    expect(screen.getByText(/to next rank/)).toBeInTheDocument();
    expect(
      screen.queryByRole('progressbar', { name: 'Daily snapshot progress' }),
    ).not.toBeInTheDocument();
    expect(container.querySelector('[data-wallet-row="true"]')).toBeInTheDocument();
    expect(container.querySelector('[data-rank-tier="gold"]')).toBeInTheDocument();
    expect(container.querySelector('[data-rank-tier="silver"]')).toBeInTheDocument();
    expect(container.querySelector('[data-mobile-standings]')).toHaveClass('md:hidden');
  });

  it('keeps the public page useful when no wallet is connected', () => {
    state.account = { address: undefined };
    const { container } = render(<Leaderboard />);

    expect(container.querySelectorAll('.count-up-text')).toHaveLength(8);
    expect(screen.queryByText('Your rank')).not.toBeInTheDocument();
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
    refreshMocks.current.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCurrent = resolve;
        }),
    );

    render(<Leaderboard />);
    await user.click(screen.getByRole('button', { name: 'Refresh' }));

    expect(await screen.findByRole('button', { name: 'Refreshing leaderboard' })).toBeDisabled();
    expect(refreshMocks.current).toHaveBeenCalledTimes(1);
    expect(refreshMocks.wallet).toHaveBeenCalledTimes(1);

    resolveCurrent?.({ error: null });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh' })).toBeEnabled());
  });

  it('offers a retryable backend error instead of the placeholder page', () => {
    state.error = new Error('offline');
    render(<Leaderboard />);

    expect(screen.getByText('Leaderboard unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
