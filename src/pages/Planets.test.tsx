// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
    currentBalanceMicros: '5000000',
    effectiveMineralsPerDayMicros: '437000000',
    upgradesEnabled: true,
    galaxyPulse: null as {
      drawingId: string;
      settledAt: string;
      slots: Array<{ planetType: string; modifierBps: number }>;
    } | null,
    planets: [] as Array<{
      planetId: string;
      planetType: string;
      sameTypeCount: number;
      collectionBonusBps: number;
      baseMineralsPerDay: string;
      effectiveMineralsPerDayMicros: string;
      upgradeLevel: number;
      upgradeBonusBps: number;
      nextUpgrade: { targetLevel: number; bonusBpsAfter: number; costMicros: string } | null;
    }>,
  },
  miningRefetch: vi.fn(),
  upgrade: {
    mutate: vi.fn(),
    reset: vi.fn(),
    variables: undefined as { planetId: string; targetLevel: number } | undefined,
    isPending: false,
    error: null as Error | null,
  },
  planetsRefetch: vi.fn(),
  ticketRefetch: vi.fn(),
  roundRefetch: vi.fn(),
  round: undefined as unknown,
  jackpot: {
    drawingId: 12n,
    phase: 'open' as const,
    state: { drawingTime: 4_102_444_800n },
    isLoading: false,
    refetch: vi.fn(),
  },
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
  useBackendPlanets: () => ({
    data: mocks.planets,
    isLoading: mocks.planetsLoading,
    isFetching: false,
    isError: false,
    refetch: mocks.planetsRefetch,
  }),
}));
vi.mock('@/hooks/useWalletMining', () => ({
  useWalletMining: () => ({ data: mocks.mining, isFetching: false, refetch: mocks.miningRefetch }),
}));
vi.mock('@/hooks/usePlanetUpgrade', () => ({ usePlanetUpgrade: () => mocks.upgrade }));
vi.mock('@/hooks/useRound', () => ({
  useRound: () => ({ data: mocks.round, isFetching: false, refetch: mocks.roundRefetch }),
}));
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
  planetId: 'planet-1',
  chainId: 84532,
  ticketId: '456',
  ownerAddress: mocks.account.address,
  name: 'Astraea',
  seed: `0x${'11'.repeat(32)}`,
  traitsHash: `0x${'22'.repeat(32)}`,
  generatorVersion: 3,
  planetType: 'Nebula',
  terrain: 'simplex',
  rarity: 'Common',
  satelliteCount: 1,
  hasRing: false,
  baseMineralsPerDay: '24',
  generatedAt: '2026-08-13T12:00:00.000Z',
  status: 'READY',
  gifHash: `0x${'33'.repeat(32)}`,
  gifUrl: '/api/planets/planet-1/gif',
  ticket: {
    ticketId: '456',
    drawingId: '12',
    normals: [3, 17, 42, 88, 201],
    bonusBall: 9,
    originTxHash: `0x${'ab'.repeat(32)}`,
    logIndex: '4',
  },
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

const miningSnapshot = (
  planet: typeof backendPlanet,
  options: { rate: string; level: number },
) => ({
  planetId: planet.planetId,
  planetType: planet.planetType,
  sameTypeCount: 1,
  collectionBonusBps: 0,
  baseMineralsPerDay: planet.baseMineralsPerDay,
  effectiveMineralsPerDayMicros: options.rate,
  upgradeLevel: options.level,
  upgradeBonusBps: options.level * 1000,
  nextUpgrade:
    options.level < 3
      ? { targetLevel: options.level + 1, bonusBpsAfter: 2500, costMicros: '300000' }
      : null,
});

const externalWalletTicket = {
  id: 'api-ticket-1000',
  wallet: mocks.account.address,
  buyer: mocks.account.address,
  round_id: '12',
  user_ticket_id: '1000',
  normals: [3, 17, 42, 88, 201],
  bonusball: 9,
  matched_normals: null,
  bonusball_match: null,
  winnings_amount: null,
  claimed: false,
  claimed_tx_hash: null,
  tx_hash: `0x${'ef'.repeat(32)}`,
  block_number: 1,
  created_at: '2026-08-13T12:00:00.000Z',
};

describe('backend My Planets', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    mocks.planets = [];
    mocks.planetsLoading = false;
    mocks.walletTickets = [];
    mocks.mining.planets = [];
    mocks.mining.currentBalanceMicros = '5000000';
    mocks.mining.effectiveMineralsPerDayMicros = '437000000';
    mocks.mining.asOf = '2026-08-13T12:00:00.000Z';
    mocks.mining.upgradesEnabled = true;
    mocks.mining.galaxyPulse = null;
    mocks.round = undefined;
    mocks.planetsRefetch.mockReset();
    mocks.ticketRefetch.mockReset();
    mocks.miningRefetch.mockReset();
    mocks.upgrade.mutate.mockReset();
    mocks.upgrade.reset.mockReset();
    mocks.upgrade.variables = undefined;
    mocks.upgrade.isPending = false;
    mocks.upgrade.error = null;
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
    expect(screen.getByAltText('Astraea animated GIF')).toHaveAttribute(
      'src',
      '/api/planets/planet-1/gif',
    );
    expect(screen.getAllByText('Nebula').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Mint|Reveal|NFT BaseScan/)).not.toBeInTheDocument();
  });

  it('places the active Galaxy Pulse between the page title and Refresh', () => {
    mocks.planets = [generatedRow(backendPlanet)];
    mocks.mining.galaxyPulse = {
      drawingId: '8421',
      settledAt: '2026-08-22T12:34:56.000Z',
      slots: [
        { planetType: 'Gaia', modifierBps: 125 },
        { planetType: 'Gaia', modifierBps: -50 },
        { planetType: 'Volcanic', modifierBps: 0 },
        { planetType: 'Toxic', modifierBps: 100 },
      ],
    };

    render(<Planets onNavigate={vi.fn()} onViewPlanet={vi.fn()} />);

    const header = screen.getByTestId('planets-page-header');
    const panel = within(header).getByTestId('galaxy-pulse-panel');
    const refresh = within(header).getByRole('button', { name: 'Refresh' });
    const summary = screen.getByTestId('collection-summary');
    expect(header).toHaveClass('lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]');
    expect(panel).toHaveClass('lg:justify-self-center');
    expect(refresh.parentElement).toHaveClass('lg:justify-self-end');
    expect(panel.compareDocumentPosition(refresh) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(panel.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(panel).getByRole('heading', { name: 'GALAXY PULSE' })).toBeInTheDocument();
    expect(within(panel).getByRole('list', { name: 'Galaxy Pulse effects' })).toBeInTheDocument();
    expect(
      within(panel).getByRole('list', { name: 'Galaxy Pulse effects' }).querySelectorAll('li'),
    ).toHaveLength(4);
    expect(within(panel).getByRole('tooltip')).toHaveTextContent('DRAWING #8421');
  });

  it('shows collection counts and mining totals in the requested label-above-value order', () => {
    mocks.planets = [generatedRow(backendPlanet), generatedRow(secondBackendPlanet)];

    render(<Planets onNavigate={vi.fn()} onViewPlanet={vi.fn()} />);

    const summary = screen.getByTestId('collection-summary');
    expect(summary).toHaveTextContent('Planets');
    expect(summary).toHaveTextContent('Tickets');
    expect(summary).toHaveTextContent('Mining Rate');
    expect(summary).toHaveTextContent('Mineral Balance');
    expect(within(summary).getByTestId('summary-planets')).toHaveTextContent('2');
    expect(within(summary).getByTestId('summary-tickets')).toHaveTextContent('2');
    expect(within(summary).getByTestId('summary-rate')).toHaveTextContent('437/day');
    expect(within(summary).getByTestId('summary-balance')).toBeInTheDocument();
    expect(screen.queryByText(/Every Megastera purchase/)).not.toBeInTheDocument();
    expect(screen.queryByText(/COLLECTION \/\s*2/)).not.toBeInTheDocument();
  });

  it('shows live spendable Mineral Balance anchored at the wallet snapshot asOf', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-13T12:00:00.000Z'));
    mocks.planets = [generatedRow(backendPlanet)];
    mocks.mining.currentBalanceMicros = '5000000';
    mocks.mining.effectiveMineralsPerDayMicros = '86400000000';
    mocks.mining.asOf = '2026-08-13T12:00:00.000Z';

    render(<Planets onNavigate={vi.fn()} onViewPlanet={vi.fn()} />);

    const summary = screen.getByTestId('collection-summary');
    expect(summary).toHaveTextContent('Mineral Balance');
    expect(within(summary).getByTestId('summary-balance')).toHaveTextContent('5');
    expect(within(summary).queryByTestId('summary-mined')).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1_000));
    expect(within(summary).getByTestId('summary-balance')).toHaveTextContent('6');
  });

  it('shows the next enabled Planet upgrade and its immutable level progression', () => {
    mocks.planets = [generatedRow(backendPlanet)];
    mocks.mining.upgradesEnabled = true;
    mocks.mining.currentBalanceMicros = '5000000';
    mocks.mining.planets = [
      {
        planetId: backendPlanet.planetId,
        planetType: backendPlanet.planetType,
        sameTypeCount: 1,
        collectionBonusBps: 0,
        baseMineralsPerDay: backendPlanet.baseMineralsPerDay,
        effectiveMineralsPerDayMicros: '24000000',
        upgradeLevel: 1,
        upgradeBonusBps: 1000,
        nextUpgrade: { targetLevel: 2, bonusBpsAfter: 2500, costMicros: '300000' },
      },
    ];

    render(<Planets onNavigate={vi.fn()} onViewPlanet={vi.fn()} />);

    const detail = within(screen.getByRole('complementary', { name: 'Selected planet detail' }));
    expect(detail.getByText('Upgrades')).toBeInTheDocument();
    expect(detail.getByText('+25%')).toBeInTheDocument();
    expect(detail.queryByText('Next upgrade: Level 2')).not.toBeInTheDocument();
    expect(detail.getByRole('button', { name: 'Upgrade · 0.3 minerals' })).toHaveTextContent(
      '0.3 minerals',
    );
  });

  it('shows the ticket status on the generated Planet card', () => {
    mocks.planets = [generatedRow(backendPlanet)];
    mocks.walletTickets = [
      {
        id: 'api-ticket-456',
        wallet: mocks.account.address,
        buyer: mocks.account.address,
        round_id: '12',
        user_ticket_id: '456',
        normals: backendPlanet.ticket.normals,
        bonusball: backendPlanet.ticket.bonusBall,
        matched_normals: 1,
        bonusball_match: false,
        winnings_amount: { amount: '0', decimals: 6 },
        claimed: false,
        claimed_tx_hash: null,
        tx_hash: backendPlanet.ticket.originTxHash,
        block_number: 1,
        created_at: '2026-08-13T12:00:00.000Z',
      },
    ];

    render(<Planets onNavigate={vi.fn()} onViewPlanet={vi.fn()} />);

    const card = screen.getByTestId('backend-planet-card-planet-1');
    expect(within(card).queryByText('Common planet')).not.toBeInTheDocument();
    expect(within(card).queryByText('VIEW ↗')).not.toBeInTheDocument();
    expect(within(card).queryByText('DRAWING #12')).not.toBeInTheDocument();
    expect(within(card).queryByText('24/day')).not.toBeInTheDocument();
    expect(within(card).queryByText('#456')).not.toBeInTheDocument();
    expect(within(card).getByTestId('planet-ticket-action')).toBeInTheDocument();
    expect(within(card).getByTestId('ticket-status-drawn')).toHaveTextContent('Drawn');
    expect(within(card).getByTestId('planet-mining-metrics')).toBeInTheDocument();
  });

  it('places mining metrics and the same-type bonus in the card body instead of the image overlay', () => {
    mocks.planets = [generatedRow(backendPlanet)];
    mocks.mining.planets = [
      {
        planetId: backendPlanet.planetId,
        planetType: backendPlanet.planetType,
        sameTypeCount: 3,
        collectionBonusBps: 500,
        baseMineralsPerDay: backendPlanet.baseMineralsPerDay,
        effectiveMineralsPerDayMicros: '25200000',
        upgradeLevel: 1,
        upgradeBonusBps: 1000,
        nextUpgrade: { targetLevel: 2, bonusBpsAfter: 2500, costMicros: '300000' },
      },
    ];

    render(<Planets onNavigate={vi.fn()} onViewPlanet={vi.fn()} />);

    const card = screen.getByTestId('backend-planet-card-planet-1');
    const metrics = within(card).getByTestId('planet-mining-metrics');
    expect(metrics).toHaveTextContent('25.2');
    expect(metrics).not.toHaveTextContent('10.1');
    expect(within(metrics).queryByText('/day')).not.toBeInTheDocument();
    expect(within(metrics).queryByText('mined')).not.toBeInTheDocument();
    expect(within(metrics).getByText('RATE')).toBeInTheDocument();
    expect(within(metrics).getByText('BOOST')).toBeInTheDocument();
    const metricGroups = [
      metrics,
      within(screen.getByRole('complementary', { name: 'Selected planet detail' })).getByTestId(
        'planet-mining-metrics',
      ),
    ];
    for (const group of metricGroups) {
      const rate = within(group).getByText('RATE');
      const boost = within(group).getByText('BOOST');
      expect(rate.compareDocumentPosition(boost) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(
        within(group).getByRole('tooltip', { name: 'Minerals per day including boost' }),
      ).toBeInTheDocument();
      expect(
        within(group).getByRole('tooltip', {
          name: 'Matching Planets +5% Planet Level +10% Galaxy Pulse +0% Total Boost +15%',
        }),
      ).toBeInTheDocument();
      expect(
        within(group).queryByRole('tooltip', { name: 'Total minerals collected' }),
      ).not.toBeInTheDocument();
    }
    expect(metrics).toHaveTextContent('+15%');
    expect(metrics.parentElement).not.toHaveClass('border-t');
    expect(within(card).queryByTestId('planet-mining-overlay')).not.toBeInTheDocument();
    expect(within(card).getByTestId('planet-ticket-action')).toBeInTheDocument();
  });

  it('shows the level beside the Planet name and adds one signal per upgrade', () => {
    mocks.planets = [generatedRow(backendPlanet)];
    mocks.mining.planets = [miningSnapshot(backendPlanet, { rate: '24000000', level: 2 })];

    render(<Planets onNavigate={vi.fn()} onViewPlanet={vi.fn()} />);

    const card = screen.getByTestId('backend-planet-card-planet-1');
    expect(within(card).queryByTestId('planet-level-badge-planet-1')).not.toBeInTheDocument();
    expect(card).toHaveAttribute('data-level', '2');
    expect(within(card).getByTestId('planet-level-signal-planet-1').children).toHaveLength(2);
    expect(card.style.clipPath).toBe('');
    expect(within(card).queryByTestId('planet-level-metric')).not.toBeInTheDocument();
    expect(within(card).getByTestId('planet-card-image-planet-1')).toHaveAttribute(
      'data-level',
      '2',
    );
    const metrics = within(card).getByTestId('planet-mining-metrics');
    expect(within(metrics).getByText('RATE')).toBeInTheDocument();
    expect(within(metrics).getByText('BOOST')).toBeInTheDocument();
    expect(within(card).getByTestId('planet-ticket-action').parentElement).toHaveClass('py-3.5');
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
    expect(
      infoPanel.compareDocumentPosition(within(detail).getByTestId('ticket-block')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
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

    const winningNumbers = within(
      screen.getByRole('complementary', { name: 'Selected planet detail' }),
    ).getByTestId('winning-numbers');
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
    await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh' })).toBeEnabled(), {
      timeout: 1_000,
    });
  });

  it('opens the selected planet in the adjacent detail panel', () => {
    mocks.planets = [generatedRow(backendPlanet), generatedRow(secondBackendPlanet)];
    const onViewPlanet = vi.fn();
    render(<Planets onNavigate={vi.fn()} onViewPlanet={onViewPlanet} />);

    expect(
      screen.getByRole('complementary', { name: 'Selected planet detail' }),
    ).toBeInTheDocument();
    const detail = screen.getByRole('complementary', { name: 'Selected planet detail' });
    expect(within(detail).getByRole('heading', { name: 'Astraea' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Select Oythyagua' }));

    expect(onViewPlanet).toHaveBeenCalledWith('planet-2');
    expect(within(detail).getByRole('heading', { name: 'Oythyagua' })).toBeInTheDocument();
    expect(within(detail).getByAltText('Oythyagua animated GIF')).toHaveAttribute(
      'src',
      '/api/planets/planet-2/gif',
    );
  });

  it('keeps selected detail immediately reachable on mobile and updates it from card selection', () => {
    mocks.planets = [generatedRow(backendPlanet), generatedRow(secondBackendPlanet)];
    const onViewPlanet = vi.fn();
    const onNavigate = vi.fn();
    const { rerender } = render(<Planets onNavigate={onNavigate} onViewPlanet={onViewPlanet} />);

    const detail = screen.getByRole('complementary', { name: 'Selected planet detail' });
    expect(detail).toHaveClass('hidden', 'lg:block');
    expect(within(detail).getByRole('heading', { name: 'Astraea' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Select Oythyagua' }));

    expect(onViewPlanet).toHaveBeenCalledWith('planet-2');
    rerender(
      <Planets onNavigate={onNavigate} onViewPlanet={onViewPlanet} routePlanetId="planet-2" />,
    );

    expect(detail).not.toHaveClass('hidden');
    expect(detail).toHaveClass('fixed', 'inset-0', 'lg:sticky');
    expect(detail).toHaveAttribute('role', 'dialog');
    expect(detail).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('button', { name: 'Select Oythyagua' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(detail).getByRole('heading', { name: 'Oythyagua' })).toBeInTheDocument();
    fireEvent.click(within(detail).getByRole('button', { name: 'Close planet details' }));
    expect(onNavigate).toHaveBeenCalledWith('planets');
  });

  it('does not add a back-to-collection action to opened detail', () => {
    mocks.planets = [generatedRow(backendPlanet)];

    render(<Planets onNavigate={vi.fn()} onViewPlanet={vi.fn()} routePlanetId="planet-1" />);

    expect(screen.queryByRole('button', { name: /Back to collection/i })).not.toBeInTheDocument();
  });

  it('sorts generated planets by each option without moving pending or ticket-only slots', () => {
    const pendingRow = {
      generationStatus: 'pending' as const,
      ticket: { ...backendPlanet.ticket, ticketId: '900', originTxHash: `0x${'dd'.repeat(32)}` },
      planet: null,
      generationError: null,
    };
    const sourceRows = [
      generatedRow(backendPlanet),
      pendingRow,
      generatedRow({ ...secondBackendPlanet, rarity: 'Legendary' }),
    ];
    mocks.planets = sourceRows;
    mocks.walletTickets = [externalWalletTicket];
    mocks.mining.planets = [
      miningSnapshot(backendPlanet, { rate: '90000000', level: 3 }),
      miningSnapshot(secondBackendPlanet, { rate: '1000000', level: 1 }),
    ];

    render(<Planets onNavigate={vi.fn()} onViewPlanet={vi.fn()} />);

    const collectionArticles = () => screen.getAllByRole('article');
    const sort = screen.getByRole('combobox', { name: 'Sort collection' });
    expect(collectionArticles()[0]).toHaveAttribute('data-testid', 'backend-planet-card-planet-2');
    expect(collectionArticles()[1]).toHaveTextContent('The ticket is safe');
    expect(collectionArticles()[2]).toHaveAttribute('data-testid', 'backend-planet-card-planet-1');
    expect(collectionArticles()[3]).toHaveTextContent('No Megastera planet attached');

    fireEvent.change(sort, { target: { value: 'rate' } });
    expect(collectionArticles()[0]).toHaveAttribute('data-testid', 'backend-planet-card-planet-1');
    expect(collectionArticles()[1]).toHaveTextContent('The ticket is safe');
    expect(collectionArticles()[2]).toHaveAttribute('data-testid', 'backend-planet-card-planet-2');
    expect(collectionArticles()[3]).toHaveTextContent('No Megastera planet attached');

    fireEvent.change(sort, { target: { value: 'rarity' } });
    expect(collectionArticles()[0]).toHaveAttribute('data-testid', 'backend-planet-card-planet-2');

    fireEvent.change(sort, { target: { value: 'level' } });
    expect(collectionArticles()[0]).toHaveAttribute('data-testid', 'backend-planet-card-planet-1');
    expect(
      mocks.planets?.map(
        (row) => (row as { planet?: { planetId: string } }).planet?.planetId ?? 'pending',
      ),
    ).toEqual(['planet-1', 'pending', 'planet-2']);
  });

  it('keeps the detail free of a duplicate wallet balance visual', () => {
    mocks.planets = [generatedRow(backendPlanet)];
    mocks.mining.currentBalanceMicros = '5000000';
    mocks.mining.effectiveMineralsPerDayMicros = '86400000000';
    mocks.mining.asOf = '2026-08-13T12:00:00.000Z';

    render(<Planets onNavigate={vi.fn()} onViewPlanet={vi.fn()} />);

    const detail = within(screen.getByRole('complementary', { name: 'Selected planet detail' }));
    expect(detail.queryByTestId('wallet-mining-balance')).not.toBeInTheDocument();
    expect(detail.queryByText('Wallet balance')).not.toBeInTheDocument();
    expect(screen.getByText('Mineral Balance')).toBeInTheDocument();
  });

  it('keeps the Planet claim action separate from card selection and uses the ticket id', () => {
    mocks.planets = [generatedRow(backendPlanet)];
    mocks.walletTickets = [
      {
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
      },
    ];
    const onViewPlanet = vi.fn();

    render(<Planets onNavigate={vi.fn()} onViewPlanet={onViewPlanet} />);

    const selectionButton = screen.getByRole('button', { name: 'Select Astraea' });
    const claimButtons = screen.getAllByRole('button', { name: 'Claim $12.50 USDC' });
    expect(claimButtons).toHaveLength(2);
    expect(claimButtons[0].className).toBe(claimButtons[1].className);
    expect(
      within(screen.getByTestId('backend-planet-card-planet-1')).getByRole('button', {
        name: 'Claim $12.50 USDC',
      }),
    ).toBeInTheDocument();
    expect(selectionButton).not.toContainElement(claimButtons[0]);

    fireEvent.click(claimButtons[0]);
    expect(mocks.claim.claim).toHaveBeenCalledWith([456n]);
    expect(onViewPlanet).not.toHaveBeenCalled();

    fireEvent.click(selectionButton);
    expect(onViewPlanet).toHaveBeenCalledWith('planet-1');
  });

  it('keeps a site ticket visible as a retryable pending card', () => {
    mocks.planets = [
      {
        generationStatus: 'pending',
        ticket: backendPlanet.ticket,
        planet: null,
        generationError: 'retryable',
      },
    ];

    render(<Planets onNavigate={vi.fn()} onViewPlanet={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'The ticket is safe' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry generation' })).toBeInTheDocument();
  });

  it('renders unmatched wallet tickets as tickets without pretending they are Planets', () => {
    mocks.walletTickets = [
      {
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
      },
    ];

    render(<Planets onNavigate={vi.fn()} onViewPlanet={vi.fn()} />);

    expect(
      screen.getByRole('heading', { name: 'No Megastera planet attached' }),
    ).toBeInTheDocument();
    expect(screen.getByText('MEGAPOT TICKET')).toBeInTheDocument();
  });
});
