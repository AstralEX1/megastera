// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

const mocks = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock('@/lib/backendApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/backendApi')>('@/lib/backendApi');
  return { ...actual, requestBackendPlanetUpgrade: mocks.request };
});

import { usePlanetUpgrade } from './usePlanetUpgrade';

const ADDRESS = '0x0000000000000000000000000000000000000001' as const;

function wrapperFor(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('usePlanetUpgrade', () => {
  afterEach(() => {
    mocks.request.mockReset();
  });

  it('invalidates and refetches wallet mining plus both live leaderboard queries after the receipt', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();
    const refetchQueries = vi.spyOn(queryClient, 'refetchQueries').mockResolvedValue();
    mocks.request.mockResolvedValue({
      purchaseId: 'purchase-1',
      planetId: 'planet-1',
      ownerAddress: ADDRESS,
      targetLevel: 1,
      bonusBpsAfter: 1000,
      costMicros: '200000',
      purchasedAt: '2026-08-13T12:00:00.000Z',
    });

    const { result } = renderHook(() => usePlanetUpgrade(ADDRESS), { wrapper: wrapperFor(queryClient) });
    act(() => result.current.mutate({ planetId: 'planet-1', targetLevel: 1 }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mocks.request).toHaveBeenCalledWith({ planetId: 'planet-1', targetLevel: 1 });

    const invalidatedKeys = invalidateQueries.mock.calls.map(([input]) => input?.queryKey);
    expect(invalidatedKeys).toEqual(expect.arrayContaining([
      ['megastera-backend', expect.any(String), 'wallet-mining', ADDRESS],
      ['megastera-backend', expect.any(String), 'leaderboard', 'current'],
      ['megastera-backend', expect.any(String), 'leaderboard', 'current-wallet', ADDRESS],
    ]));
    const refetchedKeys = refetchQueries.mock.calls.map(([input]) => input?.queryKey);
    expect(refetchedKeys).toEqual(expect.arrayContaining([
      ['megastera-backend', expect.any(String), 'wallet-mining', ADDRESS],
      ['megastera-backend', expect.any(String), 'leaderboard', 'current'],
      ['megastera-backend', expect.any(String), 'leaderboard', 'current-wallet', ADDRESS],
    ]));
  });
});
