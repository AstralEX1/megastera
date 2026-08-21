// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

const mocks = vi.hoisted(() => ({
  challenge: vi.fn(),
  request: vi.fn(),
  signMessage: vi.fn(),
  verify: vi.fn(),
}));

vi.mock('wagmi', () => ({
  useSignMessage: () => ({ signMessageAsync: mocks.signMessage }),
}));

vi.mock('@/lib/backendApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/backendApi')>('@/lib/backendApi');
  return {
    ...actual,
    requestBackendPlanetUpgrade: mocks.request,
    requestSiweChallenge: mocks.challenge,
    verifySiweLogin: mocks.verify,
  };
});

import { BackendApiError } from '@/lib/backendApi';
import { usePlanetUpgrade } from './usePlanetUpgrade';

const ADDRESS = '0x0000000000000000000000000000000000000001' as const;
const CHALLENGE = {
  address: ADDRESS,
  chainId: 8453,
  domain: 'megastera.example',
  expirationTime: '2026-08-21T12:05:00.000Z',
  issuedAt: '2026-08-21T12:00:00.000Z',
  nonce: 'a'.repeat(96),
  scheme: 'https',
  uri: 'https://megastera.example',
  version: '1',
} as const;
const MESSAGE = `https://megastera.example wants you to sign in with your Ethereum account:
${ADDRESS}


URI: https://megastera.example
Version: 1
Chain ID: 8453
Nonce: ${'a'.repeat(96)}
Issued At: 2026-08-21T12:00:00.000Z
Expiration Time: 2026-08-21T12:05:00.000Z`;

const receipt = {
  purchaseId: 'purchase-1',
  planetId: 'planet-1',
  ownerAddress: ADDRESS,
  targetLevel: 1,
  bonusBpsAfter: 1000,
  costMicros: '200000',
  purchasedAt: '2026-08-13T12:00:00.000Z',
};

function wrapperFor(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('usePlanetUpgrade', () => {
  afterEach(() => {
    mocks.challenge.mockReset();
    mocks.request.mockReset();
    mocks.signMessage.mockReset();
    mocks.verify.mockReset();
  });

  it('invalidates and refetches wallet mining plus both live leaderboard queries after the receipt', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();
    const refetchQueries = vi.spyOn(queryClient, 'refetchQueries').mockResolvedValue();
    mocks.request.mockResolvedValue(receipt);

    const { result } = renderHook(() => usePlanetUpgrade(ADDRESS), { wrapper: wrapperFor(queryClient) });
    act(() => result.current.mutate({ planetId: 'planet-1', targetLevel: 1 }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mocks.request).toHaveBeenCalledWith({
      expectedAddress: ADDRESS,
      planetId: 'planet-1',
      targetLevel: 1,
    });

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

  it('signs one canonical SIWE challenge after 401 and retries the upgrade once', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    mocks.request
      .mockRejectedValueOnce(new BackendApiError('Wallet authentication is required.', 401))
      .mockResolvedValueOnce(receipt);
    mocks.challenge.mockResolvedValue(CHALLENGE);
    mocks.signMessage.mockResolvedValue('0x12');
    mocks.verify.mockResolvedValue(undefined);

    const { result } = renderHook(() => usePlanetUpgrade(ADDRESS), { wrapper: wrapperFor(queryClient) });
    act(() => result.current.mutate({ planetId: 'planet-1', targetLevel: 1 }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mocks.request).toHaveBeenCalledTimes(2);
    expect(mocks.request).toHaveBeenNthCalledWith(1, {
      expectedAddress: ADDRESS,
      planetId: 'planet-1',
      targetLevel: 1,
    });
    expect(mocks.request).toHaveBeenNthCalledWith(2, {
      expectedAddress: ADDRESS,
      planetId: 'planet-1',
      targetLevel: 1,
    });
    expect(mocks.signMessage).toHaveBeenCalledWith({ account: ADDRESS, message: MESSAGE });
    expect(mocks.verify).toHaveBeenCalledWith({ message: MESSAGE, signature: '0x12' });
  });

  it('stops after the single authenticated retry', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    mocks.request.mockRejectedValue(new BackendApiError('Wallet authentication is required.', 401));
    mocks.challenge.mockResolvedValue(CHALLENGE);
    mocks.signMessage.mockResolvedValue('0x12');
    mocks.verify.mockResolvedValue(undefined);

    const { result } = renderHook(() => usePlanetUpgrade(ADDRESS), { wrapper: wrapperFor(queryClient) });
    act(() => result.current.mutate({ planetId: 'planet-1', targetLevel: 1 }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mocks.request).toHaveBeenCalledTimes(2);
    expect(mocks.challenge).toHaveBeenCalledOnce();
    expect(mocks.signMessage).toHaveBeenCalledOnce();
    expect(mocks.verify).toHaveBeenCalledOnce();
  });

  it('does not start SIWE for an authenticated non-owner error', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    mocks.request.mockRejectedValue(new BackendApiError('Authenticated wallet does not own this Planet.', 403));

    const { result } = renderHook(() => usePlanetUpgrade(ADDRESS), { wrapper: wrapperFor(queryClient) });
    act(() => result.current.mutate({ planetId: 'planet-1', targetLevel: 1 }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mocks.request).toHaveBeenCalledOnce();
    expect(mocks.challenge).not.toHaveBeenCalled();
    expect(mocks.signMessage).not.toHaveBeenCalled();
    expect(mocks.verify).not.toHaveBeenCalled();
  });
});
