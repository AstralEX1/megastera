// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { JACKPOT_ADDRESS } from '@/config/contracts';

const mocks = vi.hoisted(() => ({
  simulateContract: vi.fn().mockResolvedValue({ request: { simulated: true } }),
  writeContract: vi.fn(),
}));

vi.mock('wagmi', () => ({
  useAccount: () => ({ address: '0x2222222222222222222222222222222222222222' }),
  usePublicClient: () => ({ simulateContract: mocks.simulateContract }),
  useWaitForTransactionReceipt: () => ({ data: undefined, isLoading: false, error: null }),
  useWriteContract: () => ({
    data: undefined,
    isPending: false,
    error: null,
    reset: vi.fn(),
    writeContract: mocks.writeContract,
  }),
}));
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({}) }));

import { useClaimWinnings } from './useClaimWinnings';

describe('useClaimWinnings', () => {
  afterEach(() => {
    cleanup();
    mocks.simulateContract.mockClear();
    mocks.writeContract.mockClear();
  });

  it('simulates Jackpot.claimWinnings and caps each request at 50 ticket ids', async () => {
    const ticketIds = Array.from({ length: 51 }, (_, index) => BigInt(index + 1));
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { result } = renderHook(() => useClaimWinnings());

    await act(async () => {
      await result.current.claim(ticketIds);
    });

    expect(mocks.simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({
        account: '0x2222222222222222222222222222222222222222',
        address: JACKPOT_ADDRESS,
        functionName: 'claimWinnings',
        args: [ticketIds.slice(0, 50)],
      }),
    );
    expect(mocks.writeContract).toHaveBeenCalledWith({ simulated: true });
    expect(warning).toHaveBeenCalledOnce();
    warning.mockRestore();
  });
});
