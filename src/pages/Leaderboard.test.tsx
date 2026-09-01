// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const connectedAddress = '0x76ff6f88f58e083b88a80b1764ae7002e303d1a6' as const;

vi.mock('wagmi', () => ({ useAccount: () => ({ address: connectedAddress }) }));
vi.mock('@/hooks/useLeaderboard', () => ({
  useCurrentLeaderboard: () => ({
    data: {
      period: {
        id: 'live',
        startsAt: '2026-09-01T00:00:00.000Z',
        endsAt: '2026-09-02T00:00:00.000Z',
      },
      asOf: '2026-09-01T12:00:00.000Z',
      total: 1,
      offset: 0,
      limit: 50,
      rows: [
        {
          rank: 1,
          walletAddress: connectedAddress,
          scoreMicros: '999999999999',
          effectiveMineralsPerDayMicros: '999999999999',
        },
      ],
    },
    isFetching: false,
    isLoading: false,
    error: undefined,
    refetch: vi.fn(),
  }),
  useWalletLeaderboardPosition: () => ({ data: undefined, refetch: vi.fn() }),
}));
vi.mock('@/hooks/useWalletMining', () => ({
  useWalletMining: () => ({ data: undefined, refetch: vi.fn() }),
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

describe('Season 1 leaderboard results', () => {
  afterEach(cleanup);

  it('shows five prize places with tickets for the top three and NFT Planets for all five', () => {
    render(<Leaderboard />);

    expect(screen.getByRole('heading', { name: 'Season 1 results' })).toBeInTheDocument();
    const winners = screen.getByRole('region', { name: 'Winners' });
    const podium = within(winners).getByRole('list', { name: 'Top three podium' });
    const podiumPlaces = within(podium).getAllByRole('listitem');
    expect(podiumPlaces).toHaveLength(3);
    expect(within(podiumPlaces[0]).getByRole('article', { name: '1st place' })).toBeInTheDocument();
    expect(within(podiumPlaces[1]).getByRole('article', { name: '2nd place' })).toBeInTheDocument();
    expect(within(podiumPlaces[2]).getByRole('article', { name: '3rd place' })).toBeInTheDocument();

    const nftWinners = within(winners).getByRole('list', { name: 'NFT winners' });
    expect(within(nftWinners).getAllByRole('listitem')).toHaveLength(2);

    const places = within(winners).getAllByRole('article');
    expect(places).toHaveLength(5);
    expect(places[0]).toHaveTextContent('0x27a2…9324');
    expect(places[0]).toHaveTextContent('18 Megapot Tickets');
    expect(places[0]).toHaveTextContent('1/1 NFT Planet');
    expect(places[1]).toHaveTextContent('0x76ff…d1a6');
    expect(places[1]).toHaveTextContent('12 Megapot Tickets');
    expect(places[1]).toHaveTextContent('1/1 NFT Planet');
    expect(places[2]).toHaveTextContent('0x64fb…d346');
    expect(places[2]).toHaveTextContent('6 Megapot Tickets');
    expect(places[2]).toHaveTextContent('1/1 NFT Planet');
    expect(places[3]).toHaveTextContent('0x4390…743d');
    expect(places[3]).toHaveTextContent('1/1 NFT Planet');
    expect(places[3]).not.toHaveTextContent('Megapot Tickets');
    expect(places[4]).toHaveTextContent('0x3f84…cce7');
    expect(places[4]).toHaveTextContent('1/1 NFT Planet');
    expect(places[4]).not.toHaveTextContent('Megapot Tickets');

    expect(screen.getAllByText('1/1 NFT Planet')).toHaveLength(5);
    expect(screen.getByText('Mint page will be live soon')).toBeInTheDocument();
    expect(screen.queryByText(/awarded|will receive/i)).not.toBeInTheDocument();
  });

  it('renders the complete locked snapshot without live controls', () => {
    const { container } = render(<Leaderboard />);

    expect(screen.getByRole('heading', { name: 'Leaderboard snapshot' })).toBeInTheDocument();
    expect(screen.getByText('2026-08-28 23:59 UTC')).toBeInTheDocument();
    expect(screen.getByText('48 players')).toBeInTheDocument();
    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(49);
    expect(rows[1]).toHaveTextContent('#1');
    expect(rows[1]).toHaveTextContent('0x27a2…9324');
    expect(rows[1]).toHaveTextContent('14,799');
    expect(rows[1]).not.toHaveTextContent('14,798.690309');
    expect(container.querySelectorAll('[data-wallet-row="true"]')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /refresh/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Active players')).not.toBeInTheDocument();
    expect(screen.queryByText('Per day')).not.toBeInTheDocument();
    expect(screen.queryByText('Your rank')).not.toBeInTheDocument();
  });
});
