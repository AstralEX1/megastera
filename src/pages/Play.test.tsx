// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  buy: vi.fn(),
  generate: vi.fn(),
  account: { address: '0x0000000000000000000000000000000000000001', isConnected: true },
  directTickets: [] as Array<Record<string, unknown>>,
}));

vi.mock('wagmi', () => ({
  useAccount: () => mocks.account,
  useReadContract: () => ({ data: 100_000_000n, error: null, isLoading: false, refetch: vi.fn() }),
  useWriteContract: () => ({ writeContract: vi.fn(), data: undefined, isPending: false, error: null, reset: vi.fn() }),
  useWaitForTransactionReceipt: () => ({ data: undefined, isLoading: false }),
}));
vi.mock('@/hooks/useJackpotState', () => ({
  useJackpotState: () => ({
    state: { ballMax: 50, bonusballMax: 10, ticketPrice: 1_000_000n, prizePool: 0n },
    drawingId: 218n,
    phase: 'open',
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));
vi.mock('@/hooks/useBuyTickets', () => ({
  useBuyTickets: () => ({
    isReady: true,
    isPending: false,
    isSuccess: mocks.directTickets.length > 0,
    purchasedTickets: mocks.directTickets,
    buy: mocks.buy,
    reset: vi.fn(),
    error: null,
  }),
}));
vi.mock('@/hooks/useBulkPurchase', () => ({
  useBulkPurchase: () => ({
    minimumTicketCount: undefined,
    hasActiveOrder: false,
    createOrder: vi.fn(),
    cancelOrder: vi.fn(),
    reset: vi.fn(),
    create: { isReady: false, isPending: false, isWaitingSignature: false, isPreparing: false, isMining: false, isSuccess: false, error: null, reset: vi.fn() },
    cancel: { isPending: false },
    confirmedTickets: [],
    orderInfo: [],
  }),
}));
vi.mock('@/lib/backendApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/backendApi')>('@/lib/backendApi');
  return { ...actual, requestBackendPlanetGeneration: mocks.generate };
});

import { Play } from './Play';

const ticket = (ticketId: bigint, logIndex = 0n) => ({
  ticketId,
  drawingId: 218n,
  normals: [1, 2, 3, 4, 5],
  bonusBall: 1,
  originTxHash: `0x${ticketId.toString().padStart(64, '0')}`,
  logIndex,
});

const planet = (ticketId: string) => ({
  planetId: `planet-${ticketId}`,
  chainId: 84532,
  ticketId,
  ownerAddress: mocks.account.address,
  name: `Planet ${ticketId}`,
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
  gifUrl: `/api/planets/planet-${ticketId}/gif`,
  ticket: { ticketId, drawingId: '218', normals: [1, 2, 3, 4, 5], bonusBall: 1, originTxHash: `0x${ticketId.padStart(64, '0')}`, logIndex: '0' },
});

describe('Play backend generation flow', () => {
  afterEach(() => {
    cleanup();
    mocks.buy.mockReset();
    mocks.generate.mockReset();
    mocks.directTickets = [];
    mocks.account.isConnected = true;
  });

  it('does not render a duplicate wallet notice inside checkout', () => {
    mocks.account.isConnected = false;

    render(<Play />);

    expect(screen.queryByText('Connect your wallet to buy tickets.')).not.toBeInTheDocument();
  });

  it('starts Megapot purchase from Explore', async () => {
    const user = userEvent.setup();
    render(<Play />);
    await user.click(screen.getByRole('button', { name: /^Explore 3/ }));
    expect(mocks.buy).toHaveBeenCalledWith({ count: 3, bounds: { ballMax: 50, bonusballMax: 10 }, customTickets: [] });
  });

  it('shows the exploring state and then full Planet cards with exactly two next actions', async () => {
    mocks.directTickets = [ticket(34n), ticket(35n, 1n), ticket(36n, 2n)];
    mocks.generate.mockImplementation(async ({ transactionHash }: { transactionHash: string }) => planet(String(BigInt(transactionHash))));
    const user = userEvent.setup();
    render(<Play />);
    await user.click(screen.getByRole('button', { name: /^Explore 3/ }));
    expect(await screen.findByText('Your planets are ready.')).toBeInTheDocument();
    expect(mocks.generate).toHaveBeenCalledTimes(3);
    expect(screen.getAllByRole('img')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Explore again' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'My planets' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Claim|Reveal|Mint/i })).not.toBeInTheDocument();
  });

  it('retries backend generation after an early finality failure without repurchasing', async () => {
    mocks.directTickets = [ticket(34n), ticket(35n, 1n), ticket(36n, 2n)];
    let attempts = 0;
    mocks.generate.mockImplementation(async ({ transactionHash }: { transactionHash: string }) => {
      attempts += 1;
      if (attempts === 1) throw new Error('Receipt requires 6 confirmations.');
      return planet(String(BigInt(transactionHash)));
    });
    const user = userEvent.setup();
    render(<Play />);
    await user.click(screen.getByRole('button', { name: /^Explore 3/ }));

    expect(await screen.findByText('Exploring planets…')).toBeInTheDocument();
    expect(await screen.findByText('Your planets are ready.', undefined, { timeout: 4_000 })).toBeInTheDocument();
    expect(mocks.buy).toHaveBeenCalledTimes(1);
    expect(mocks.generate).toHaveBeenCalledTimes(4);
  });
});
