// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  account: { address: '0x0000000000000000000000000000000000000001', isConnected: true },
  planets: [] as unknown[] | undefined,
  planetsLoading: false,
  walletTickets: [] as unknown[],
  mining: {
    ownerAddress: '0x0000000000000000000000000000000000000001',
    asOf: '2026-08-13T12:00:00.000Z',
    ownedPlanetCount: 0,
    earnedMicros: '123123000000',
    effectiveMineralsPerDayMicros: '437000000',
    planets: [] as Array<{
      planetId: string;
      planetType: string;
      sameTypeCount: number;
      collectionBonusBps: number;
      baseMineralsPerDay: string;
      effectiveMineralsPerDayMicros: string;
      earnedMicros: string;
      activeSince: string;
    }>,
  },
  miningRefetch: vi.fn(),
  planetsRefetch: vi.fn(),
  ticketRefetch: vi.fn(),
  roundRefetch: vi.fn(),
  round: undefined as unknown,
  jackpot: { drawingId: 12n, phase: 'open' as const, state: { drawingTime: 4_102_444_800n }, isLoading: false, refetch: vi.fn() },
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
  useBackendPlanets: () => ({ data: mocks.planets, isLoading: mocks.planetsLoading, isFetching: false, isError: false, refetch: mocks.planetsRefetch }),
}));
vi.mock('@/hooks/useWalletMining', () => ({ useWalletMining: () => ({ data: mocks.mining, isFetching: false, refetch: mocks.miningRefetch }) }));
vi.mock('@/hooks/useRound', () => ({ useRound: () => ({ data: mocks.round, isFetching: false, refetch: mocks.roundRefetch }) }));
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
    refetch: mocks.ticketRefetch,
    isFetching: false,
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
    mocks.mining.planets = [];
    mocks.round = undefined;
    mocks.planetsRefetch.mockReset();
    mocks.ticketRefetch.mockReset();
    mocks.miningRefetch.mockReset();
    mocks.roundRefetch.mockReset();
    mocks.jackpot.refetch.mockReset();
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

  it('shows collection counts and mining totals in the requested label-above-value order', () => {
    mocks.planets = [generatedRow(backendPlanet), generatedRow(secondBackendPlanet)];

    render(<Planets onNavigate={vi.fn()} onViewPlanet={vi.fn()} />);

    const summary = screen.getByTestId('collection-summary');
    expect(summary).toHaveTextContent('Planets');
    expect(summary).toHaveTextContent('Tickets');
    expect(summary).toHaveTextContent('Mining Rate');
    expect(summary).toHaveTextContent('Mined');
    expect(within(summary).getByTestId('summary-planets')).toHaveTextContent('2');
    expect(within(summary).getByTestId('summary-tickets')).toHaveTextContent('2');
    expect(within(summary).getByTestId('summary-rate')).toHaveTextContent('437/day');
    expect(within(summary).getByTestId('summary-mined')).toHaveTextContent('123,123');
    expect(screen.queryByText(/Every Megastera purchase/)).not.toBeInTheDocument();
    expect(screen.queryByText(/COLLECTION \/\s*2/)).not.toBeInTheDocument();
  });

  it('keeps only the planet type in the image overlay and omits ticket status controls', () => {
    mocks.planets = [generatedRow(backendPlanet)];

    render(<Planets onNavigate={vi.fn()} onViewPlanet={vi.fn()} />);

    const card = screen.getByTestId('backend-planet-card-planet-1');
    expect(within(card).queryByText('Common planet')).not.toBeInTheDocument();
    expect(within(card).queryByText('VIEW ↗')).not.toBeInTheDocument();
    expect(within(card).queryByText('DRAWING #12')).not.toBeInTheDocument();
    expect(within(card).queryByText('24/day')).not.toBeInTheDocument();
    expect(within(card).queryByText('#456')).not.toBeInTheDocument();
    expect(within(card).queryByTestId('planet-status-overlay')).not.toBeInTheDocument();
    expect(within(card).queryByTestId('planet-status-footer')).not.toBeInTheDocument();
    expect(within(card).queryByTestId('planet-ticket-action')).not.toBeInTheDocument();
    expect(within(card).getByTestId('planet-mining-metrics')).toBeInTheDocument();
  });

  it('places mining metrics and the same-type bonus in the card body instead of the image overlay', () => {
    mocks.planets = [generatedRow(backendPlanet)];
    mocks.mining.planets = [{
      planetId: backendPlanet.planetId,
      planetType: backendPlanet.planetType,
      sameTypeCount: 3,
      collectionBonusBps: 500,
      baseMineralsPerDay: backendPlanet.baseMineralsPerDay,
      effectiveMineralsPerDayMicros: '25200000',
      earnedMicros: '10100000',
      activeSince: '2026-08-10T00:00:00.000Z',
    }];

    render(<Planets onNavigate={vi.fn()} onViewPlanet={vi.fn()} />);

    const card = screen.getByTestId('backend-planet-card-planet-1');
    const metrics = within(card).getByTestId('planet-mining-metrics');
    expect(metrics).toHaveTextContent('25.2');
    expect(metrics).toHaveTextContent('10.1');
    expect(within(metrics).queryByText('/day')).not.toBeInTheDocument();
    expect(within(metrics).queryByText('mined')).not.toBeInTheDocument();
    expect(within(metrics).getByText('RATE')).toBeInTheDocument();
    expect(within(metrics).getByText('MINED')).toBeInTheDocument();
    expect(within(metrics).getByText('BOOST')).toBeInTheDocument();
    const metricGroups = [metrics, within(screen.getByRole('complementary', { name: 'Selected planet detail' })).getByTestId('planet-mining-metrics')];
    for (const group of metricGroups) {
      const rate = within(group).getByText('RATE');
      const boost = within(group).getByText('BOOST');
      const mined = within(group).getByText('MINED');
      expect(rate.compareDocumentPosition(boost) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(boost.compareDocumentPosition(mined) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(mined.parentElement).toHaveClass('border-l');
      expect(within(group).getByRole('tooltip', { name: 'Minerals per day including boost' })).toBeInTheDocument();
      expect(within(group).getByRole('tooltip', { name: 'Bonus from matching planet types' })).toBeInTheDocument();
      expect(within(group).getByRole('tooltip', { name: 'Total minerals collected' })).toBeInTheDocument();
    }
    expect(metrics).toHaveTextContent('+5%');
    expect(metrics.parentElement).not.toHaveClass('border-t');
    expect(within(card).queryByTestId('planet-mining-overlay')).not.toBeInTheDocument();
    expect(within(card).queryByTestId('planet-ticket-action')).not.toBeInTheDocument();
  });

  it('groups mining and details in one info panel while keeping mining prominent', () => {
    mocks.planets = [generatedRow({ ...backendPlanet, rarity: 'Epic' })];

    render(<Planets onNavigate={vi.fn()} onViewPlanet={vi.fn()} />);

    const card = screen.getByTestId('backend-planet-card-planet-1');
    expect(card.className).toContain('shadow-[0_0_');
    const detail = screen.getByRole('complementary', { name: 'Selected planet detail' });
    expect(within(detail).queryByText('SELECTED PLANET')).not.toBeInTheDocument();
    expect(within(detail).queryByText('#456')).not.toBeInTheDocument();
    expect(within(detail).queryByText('MINING ACTIVE')).not.toBeInTheDocument();
    expect(within(detail).queryByText(/Generated /)).not.toBeInTheDocument();
    expect(within(detail).getByTestId('planet-detail-title')).not.toHaveTextContent('Nebula');
    expect(within(detail).queryByTestId('planet-mining-overlay')).not.toBeInTheDocument();
    const infoPanel = within(detail).getByTestId('planet-detail-info');
    const miningPanel = within(infoPanel).getByTestId('planet-detail-mining');
    const detailsPanel = within(infoPanel).getByTestId('planet-detail-details');
    expect(infoPanel).toHaveAttribute('aria-label', 'Planet info');
    expect(infoPanel).not.toHaveClass('border');
    expect(within(detail).queryByRole('heading', { name: 'Mining' })).not.toBeInTheDocument();
    expect(miningPanel).not.toHaveClass('border');
    expect(detailsPanel).toHaveClass('border-t');
    expect(infoPanel.compareDocumentPosition(within(detail).getByTestId('ticket-block')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(detail).getByTestId('ticket-block')).toHaveTextContent('DRAWING #12');
    expect(within(detail).getByTestId('planet-detail-image')).toHaveClass('border-2');
    expect(within(detail).getByTestId('planet-detail-image').className).toContain('shadow-[0_0_');
  });

  it('shows winning numbers in details after the Megapot drawing is settled', () => {
    mocks.planets = [generatedRow(backendPlanet)];
    mocks.round = {
      status: 'settled',
      winning_numbers: { normals: [11, 22, 33, 44, 55], bonusball: 7 },
    };

    render(<Planets onNavigate={vi.fn()} onViewPlanet={vi.fn()} />);

    const winningNumbers = within(screen.getByRole('complementary', { name: 'Selected planet detail' })).getByTestId('winning-numbers');
    expect(winningNumbers).toHaveTextContent('Winning numbers');
    for (const number of ['11', '22', '33', '44', '55', '7']) {
      expect(within(winningNumbers).getByText(number)).toBeInTheDocument();
    }
  });

  it('keeps winning numbers hidden while the Data API round is active', () => {
    mocks.planets = [generatedRow(backendPlanet)];
    mocks.round = {
      status: 'active',
      winning_numbers: { normals: [11, 22, 33, 44, 55], bonusball: 7 },
    };

    render(<Planets onNavigate={vi.fn()} onViewPlanet={vi.fn()} />);

    expect(screen.queryByTestId('winning-numbers')).not.toBeInTheDocument();
  });

  it('refreshes all My Planets data sources with a visible pending state', async () => {
    mocks.planets = [generatedRow(backendPlanet)];

    render(<Planets onNavigate={vi.fn()} onViewPlanet={vi.fn()} />);

    const refresh = screen.getByRole('button', { name: 'Refresh' });
    fireEvent.click(refresh);

    expect(await screen.findByRole('button', { name: 'Refreshing My Planets' })).toBeDisabled();
    await waitFor(() => {
      expect(mocks.planetsRefetch).toHaveBeenCalledOnce();
      expect(mocks.ticketRefetch).toHaveBeenCalledOnce();
      expect(mocks.miningRefetch).toHaveBeenCalledOnce();
      expect(mocks.roundRefetch).toHaveBeenCalledOnce();
      expect(mocks.jackpot.refetch).toHaveBeenCalledOnce();
    });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh' })).toBeEnabled(), { timeout: 1_000 });
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
    expect(claimButtons).toHaveLength(1);
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
