// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  account: { address: '0x0000000000000000000000000000000000000001', isConnected: true },
  planets: [] as unknown[] | undefined,
  planetsLoading: false,
  walletTickets: [] as unknown[],
  jackpot: { drawingId: 12n, phase: 'open' as const, state: { drawingTime: 4_102_444_800n } },
  claim: {
    claim: vi.fn(),
    txHash: undefined,
    isWaitingSignature: false,
    isMining: false,
    isPending: false,
    isSuccess: false,
    error: null,
    reset: vi.fn(),
  },
}));

vi.mock('wagmi', () => ({ useAccount: () => mocks.account }));
vi.mock('@/hooks/useBackendPlanets', () => ({
  useBackendPlanets: () => ({ data: mocks.planets, isLoading: mocks.planetsLoading, isError: false, refetch: vi.fn() }),
}));
vi.mock('@/hooks/useWalletMining', () => ({ useWalletMining: () => ({ data: { planets: [] } }) }));
vi.mock('@/hooks/useJackpotState', () => ({ useJackpotState: () => mocks.jackpot }));
vi.mock('@/hooks/useWalletTickets', () => ({
  useWalletTickets: () => ({
    tickets: mocks.walletTickets,
    groupedByRound: [],
    visibleGroupedByRound: [],
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: false,
    error: undefined,
    refetch: vi.fn(),
  }),
}));
vi.mock('@/hooks/useClaimWinnings', () => ({ useClaimWinnings: () => mocks.claim }));
vi.mock('@/components/planets/BackendPlanetPreview', () => ({
  BackendPlanetPreview: ({ planet }: { planet: { planetId: string; name: string } }) => (
    <div data-testid={`planet-static-preview-${planet.planetId}`}>{planet.name} static preview</div>
  ),
}));

import { Planets } from './Planets';

const backendPlanet = {
  planetId: 'planet-1', chainId: 84532, ticketId: '456', ownerAddress: mocks.account.address,
  name: 'Astraea', seed: `0x${'11'.repeat(32)}`, traitsHash: `0x${'22'.repeat(32)}`,
  generatorVersion: 3, planetType: 'Nebula', terrain: 'simplex', rarity: 'Common',
  satelliteCount: 1, hasRing: false, baseMineralsPerDay: '24', generatedAt: '2026-08-13T12:00:00.000Z',
  status: 'READY', gifHash: `0x${'33'.repeat(32)}`, gifUrl: '/api/planets/planet-1/gif',
  ticket: { ticketId: '456', drawingId: '12', normals: [3, 17, 42, 88, 201], bonusBall: 9, originTxHash: `0x${'ab'.repeat(32)}`, logIndex: '4' },
};

const generatedRow = (planet: typeof backendPlanet) => ({
  generationStatus: 'generated' as const,
  ticket: planet.ticket,
  planet,
  generationError: null,
});

const secondBackendPlanet = {
  ...backendPlanet,
  planetId: 'planet-2',
  ticketId: '789',
  name: 'Oythyagua',
  planetType: 'Volcanic',
  gifUrl: '/api/planets/planet-2/gif',
  ticket: { ...backendPlanet.ticket, ticketId: '789' },
};

describe('backend My Planets', () => {
  afterEach(() => {
    cleanup();
    mocks.planets = [];
    mocks.planetsLoading = false;
    mocks.walletTickets = [];
    mocks.claim.claim.mockReset();
    window.localStorage.clear();
  });

  it('shows the FadeArc loading state while the collection is loading', () => {
    mocks.planetsLoading = true;
    mocks.planets = undefined;

    render(<Planets onNavigate={vi.fn()} onViewPlanet={vi.fn()} />);

    expect(screen.getByRole('status', { name: 'Loading My Planets' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Loading My Planets' })).toBeInTheDocument();
  });

  it('shows the empty state without NFT controls', () => {
    render(<Planets onNavigate={vi.fn()} onViewPlanet={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'No tickets yet' })).toBeInTheDocument();
    expect(screen.queryByText(/Mint|Reveal|NFT BaseScan/)).not.toBeInTheDocument();
  });

  it('uses a static preview in cards and keeps the canonical GIF in the detail panel', () => {
    mocks.planets = [generatedRow(backendPlanet)];
    render(<Planets onNavigate={vi.fn()} onViewPlanet={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'My Planets' })).toBeInTheDocument();
    expect(screen.getByTestId('planet-static-preview-planet-1')).toBeInTheDocument();
    expect(screen.getByAltText('Astraea animated GIF')).toHaveAttribute('src', '/api/planets/planet-1/gif');
    expect(screen.getAllByText('Nebula').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Mint|Reveal|NFT BaseScan/)).not.toBeInTheDocument();
  });

  it('opens the selected planet in the adjacent detail panel', () => {
    mocks.planets = [generatedRow(backendPlanet), generatedRow(secondBackendPlanet)];
    const onViewPlanet = vi.fn();
    render(<Planets onNavigate={vi.fn()} onViewPlanet={onViewPlanet} />);

    expect(screen.getByRole('complementary', { name: 'Selected planet detail' })).toBeInTheDocument();
    const detail = screen.getByRole('complementary', { name: 'Selected planet detail' });
    expect(within(detail).getByRole('heading', { name: 'Astraea' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Select Oythyagua' }));

    expect(onViewPlanet).toHaveBeenCalledWith('planet-2');
    expect(within(detail).getByRole('heading', { name: 'Oythyagua' })).toBeInTheDocument();
    expect(within(detail).getByAltText('Oythyagua animated GIF')).toHaveAttribute('src', '/api/planets/planet-2/gif');
  });

  it('keeps the Planet claim action separate from card selection and uses the ticket id', () => {
    mocks.planets = [generatedRow(backendPlanet)];
    mocks.walletTickets = [{
      id: 'api-ticket-456',
      wallet: mocks.account.address,
      buyer: mocks.account.address,
      round_id: '12',
      user_ticket_id: '456',
      normals: backendPlanet.ticket.normals,
      bonusball: backendPlanet.ticket.bonusBall,
      matched_normals: 5,
      bonusball_match: true,
      winnings_amount: { amount: '12500000', decimals: 6 },
      claimed: false,
      claimed_tx_hash: null,
      tx_hash: backendPlanet.ticket.originTxHash,
      block_number: 1,
      created_at: '2026-08-13T12:00:00.000Z',
    }];
    const onViewPlanet = vi.fn();

    render(<Planets onNavigate={vi.fn()} onViewPlanet={onViewPlanet} />);

    const selectionButton = screen.getByRole('button', { name: 'Select Astraea' });
    const claimButtons = screen.getAllByRole('button', { name: 'Claim $12.50 USDC' });
    expect(claimButtons).toHaveLength(2);
    expect(selectionButton).not.toContainElement(claimButtons[0]);

    fireEvent.click(claimButtons[0]);
    expect(mocks.claim.claim).toHaveBeenCalledWith([456n]);
    expect(onViewPlanet).not.toHaveBeenCalled();

    fireEvent.click(selectionButton);
    expect(onViewPlanet).toHaveBeenCalledWith('planet-1');
  });

  it('keeps a site ticket visible as a retryable pending card', () => {
    mocks.planets = [{ generationStatus: 'pending', ticket: backendPlanet.ticket, planet: null, generationError: 'retryable' }];

    render(<Planets onNavigate={vi.fn()} onViewPlanet={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'The ticket is safe' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry generation' })).toBeInTheDocument();
  });

  it('renders unmatched wallet tickets as tickets without pretending they are Planets', () => {
    mocks.walletTickets = [{
      id: 'api-ticket-999',
      wallet: mocks.account.address,
      buyer: mocks.account.address,
      round_id: '12',
      user_ticket_id: '999',
      normals: [3, 17, 42, 88, 201],
      bonusball: 9,
      matched_normals: null,
      bonusball_match: null,
      winnings_amount: null,
      claimed: false,
      claimed_tx_hash: null,
      tx_hash: `0x${'cd'.repeat(32)}`,
      block_number: 1,
      created_at: '2026-08-13T12:00:00.000Z',
    }];

    render(<Planets onNavigate={vi.fn()} onViewPlanet={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'No Megastera planet attached' })).toBeInTheDocument();
    expect(screen.getByText('MEGAPOT TICKET')).toBeInTheDocument();
  });
});
