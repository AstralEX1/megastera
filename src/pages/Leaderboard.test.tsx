// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  account: { address: '0x2222222222222222222222222222222222222222' as `0x${string}` | undefined },
  error: undefined as Error | undefined,
  isLoading: false,
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
  useCurrentLeaderboard: () => ({ data: current, isLoading: state.isLoading, error: state.error, refetch: vi.fn() }),
  useWalletLeaderboardPosition: () => ({ data: { period: current.period, asOf: current.asOf, row: current.rows[1], distanceToNextRankMicros: '6000000' }, isLoading: false }),
}));

import { Leaderboard } from './Leaderboard';

describe('Leaderboard', () => {
  beforeEach(() => {
    state.error = undefined;
    state.isLoading = false;
    state.account = { address: '0x2222222222222222222222222222222222222222' };
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
    expect(screen.getByText('LIVE · GENERATED AT + BASE RATE')).toBeInTheDocument();
    expect(screen.getAllByText('25').length).toBeGreaterThan(0);
    expect(screen.getAllByText('19').length).toBeGreaterThan(0);
    expect(screen.getByText('Your rank')).toBeInTheDocument();
    expect(screen.getByText('6 to next rank')).toBeInTheDocument();
    expect(screen.getByText(/As of Aug 12/)).toBeInTheDocument();
    expect(screen.queryByRole('progressbar', { name: 'Daily snapshot progress' })).not.toBeInTheDocument();
    expect(container.querySelector('[data-wallet-row="true"]')).toBeInTheDocument();
    expect(container.querySelector('[data-mobile-standings]')).toHaveClass('md:hidden');
  });

  it('keeps the public page useful when no wallet is connected', () => {
    state.account = { address: undefined };
    render(<Leaderboard />);

    expect(screen.getAllByText('25').length).toBeGreaterThan(0);
    expect(screen.queryByText('Your rank')).not.toBeInTheDocument();
  });

  it('offers a retryable backend error instead of the placeholder page', () => {
    state.error = new Error('offline');
    render(<Leaderboard />);

    expect(screen.getByText('Leaderboard unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
