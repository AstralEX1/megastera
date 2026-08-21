import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Address } from 'viem';
import { BACKEND_API_BASE_URL, requestBackendPlanetUpgrade } from '@/lib/backendApi';

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

  return useMutation({
    mutationFn: (variables: PlanetUpgradeVariables) => {
      if (!address) throw new Error('A connected wallet is required.');
      return requestBackendPlanetUpgrade(variables);
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
