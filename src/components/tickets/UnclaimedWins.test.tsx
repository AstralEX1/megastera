// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Win } from '@/lib/api';

const mocks = vi.hoisted(() => ({
  claim: vi.fn(),
  reset: vi.fn(),
  refetch: vi.fn(),
}));

vi.mock('wagmi', () => ({
  useAccount: () => ({ address: '0x2222222222222222222222222222222222222222' }),
}));
vi.mock('@/hooks/useWalletWins', () => ({
  useWalletWins: () => ({
    grouped: [
      {
        roundId: '7',
        wins: [
          {
            id: '99',
            wallet: '0x2222222222222222222222222222222222222222',
            buyer: '0x2222222222222222222222222222222222222222',
            round_id: '7',
            user_ticket_id: '42',
            normals: [1, 2, 3, 4, 5],
            bonusball: 6,
            matched_normals: 2,
            bonusball_match: true,
            amount: { amount: '1250000', decimals: 6 },
            claimed: false,
            claimed_tx_hash: null,
            tx_hash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            block_number: 1,
            created_at: '2026-08-13T12:00:00.000Z',
          } as Win,
        ],
        totalAmount: 1250000n,
      },
    ],
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: false,
    error: null,
    refetch: mocks.refetch,
  }),
}));
vi.mock('@/hooks/useClaimWinnings', () => ({
  useClaimWinnings: () => ({
    claim: mocks.claim,
    txHash: undefined,
    isWaitingSignature: false,
    isMining: false,
    isPending: false,
    isSuccess: false,
    error: null,
    reset: mocks.reset,
  }),
}));
vi.mock('@/hooks/useRound', () => ({ useRound: () => ({ isLoading: false, data: undefined }) }));

import { UnclaimedWins } from './UnclaimedWins';

describe('UnclaimedWins', () => {
  afterEach(() => {
    cleanup();
    mocks.claim.mockClear();
  });

  it('keeps an explicit claim-winnings affordance and passes API ticket ids on-chain', () => {
    render(<UnclaimedWins />);

    fireEvent.click(screen.getByRole('button', { name: /Claim winnings/i }));

    expect(screen.getByRole('button', { name: /Claim winnings/i })).toBeInTheDocument();
    expect(mocks.claim).toHaveBeenCalledWith([42n]);
  });
});
