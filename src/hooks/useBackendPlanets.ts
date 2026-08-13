import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import type { Address } from 'viem';
import {
  BACKEND_API_BASE_URL,
  fetchBackendPlanets,
  requestBackendPlanetGeneration,
  type BackendPlanet,
} from '@/lib/backendApi';
import type { PurchasedTicket } from '@/lib/purchaseReceipt';

export function useBackendPlanets(address: Address | undefined) {
  return useQuery({
    queryKey: ['megastera-backend', BACKEND_API_BASE_URL, 'planets', address],
    queryFn: ({ signal }) => {
      if (!address) throw new Error('A connected wallet is required.');
      return fetchBackendPlanets(address, { signal });
    },
    enabled: !!address,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useGenerateBackendPlanets() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ address, tickets }: { address: Address; tickets: readonly PurchasedTicket[] }) => {
      const planets: BackendPlanet[] = [];
      for (const ticket of tickets) {
        planets.push(
          await requestBackendPlanetGeneration({
            transactionHash: ticket.originTxHash,
            logIndex: ticket.logIndex,
            recipient: address,
          }),
        );
      }
      return planets;
    },
    onSuccess: (_planets, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['megastera-backend', BACKEND_API_BASE_URL, 'planets', variables.address] });
      void queryClient.invalidateQueries({ queryKey: ['megastera-backend', BACKEND_API_BASE_URL, 'wallet-mining', variables.address] });
    },
  });
}

export function useConnectedBackendPlanets() {
  const { address } = useAccount();
  return useBackendPlanets(address);
}
