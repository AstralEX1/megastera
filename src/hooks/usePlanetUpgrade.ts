import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Address } from 'viem';
import { createSiweMessage } from 'viem/siwe';
import { useSignMessage } from 'wagmi';
import {
  BACKEND_API_BASE_URL,
  BackendApiError,
  requestBackendPlanetUpgrade,
  requestSiweChallenge,
  verifySiweLogin,
} from '@/lib/backendApi';

export type PlanetUpgradeVariables = {
  planetId: string;
  targetLevel: number;
};

export const walletMiningQueryKey = (address: Address) =>
  ['megastera-backend', BACKEND_API_BASE_URL, 'wallet-mining', address] as const;

const currentLeaderboardQueryKey = ['megastera-backend', BACKEND_API_BASE_URL, 'leaderboard', 'current'] as const;
const currentWalletLeaderboardQueryKey = (address: Address) =>
  ['megastera-backend', BACKEND_API_BASE_URL, 'leaderboard', 'current-wallet', address] as const;

export function usePlanetUpgrade(address: Address | undefined) {
  const queryClient = useQueryClient();
  const { signMessageAsync } = useSignMessage();

  return useMutation({
    mutationFn: async (variables: PlanetUpgradeVariables) => {
      if (!address) throw new Error('A connected wallet is required.');
      const requestUpgrade = () => requestBackendPlanetUpgrade({
        ...variables,
        expectedAddress: address,
      });
      try {
        return await requestUpgrade();
      } catch (error) {
        if (!(error instanceof BackendApiError) || error.status !== 401) throw error;
      }

      const challenge = await requestSiweChallenge(address);
      const message = createSiweMessage({
        address: challenge.address,
        chainId: challenge.chainId,
        domain: challenge.domain,
        expirationTime: new Date(challenge.expirationTime),
        issuedAt: new Date(challenge.issuedAt),
        nonce: challenge.nonce,
        scheme: challenge.scheme,
        uri: challenge.uri,
        version: challenge.version,
      });
      const signature = await signMessageAsync({ account: address, message });
      await verifySiweLogin({ message, signature });
      return requestUpgrade();
    },
    onSuccess: async (_receipt) => {
      if (!address) return;
      const walletKey = walletMiningQueryKey(address);
      const walletLeaderboardKey = currentWalletLeaderboardQueryKey(address);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: walletKey }),
        queryClient.invalidateQueries({ queryKey: currentLeaderboardQueryKey }),
        queryClient.invalidateQueries({ queryKey: walletLeaderboardKey }),
      ]);
      await Promise.all([
        queryClient.refetchQueries({ queryKey: walletKey, type: 'all' }),
        queryClient.refetchQueries({ queryKey: currentLeaderboardQueryKey, type: 'all' }),
        queryClient.refetchQueries({ queryKey: walletLeaderboardKey, type: 'all' }),
      ]);
    },
  });
}
