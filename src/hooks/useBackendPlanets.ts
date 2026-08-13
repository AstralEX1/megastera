import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAccount, usePublicClient } from 'wagmi';
import { useEffect, useRef } from 'react';
import type { Address } from 'viem';
import {
  BACKEND_API_BASE_URL,
  fetchBackendPlanetCollection,
  requestBackendPlanetGeneration,
  requestBackendPlanetGenerationBatch,
  type BackendPlanet,
  type BackendPlanetCollectionRow,
} from '@/lib/backendApi';
import {
  readPendingPurchases,
  readPersistedPurchasedTickets,
  type PurchasedTicket,
} from '@/lib/purchaseReceipt';
import { api } from '@/lib/api';
import {
  collectCanonicalReceiptTickets,
  collectWalletTicketTransactionHashes,
} from '@/lib/ticketCatchUp';

const BACKEND_PLANETS_QUERY = (address: Address) =>
  ['megastera-backend', BACKEND_API_BASE_URL, 'planets', address] as const;

function ticketKey(ticket: { originTxHash: string; logIndex: string | bigint }): string {
  return `${ticket.originTxHash.toLowerCase()}:${ticket.logIndex.toString()}`;
}

const CATCH_UP_INTERVAL_MS = 60_000;

export function useBackendPlanets(address: Address | undefined) {
  const queryClient = useQueryClient();
  const publicClient = usePublicClient();
  const running = useRef(false);
  const query = useQuery({
    queryKey: ['megastera-backend', BACKEND_API_BASE_URL, 'planets', address],
    queryFn: ({ signal }) => {
      if (!address) throw new Error('A connected wallet is required.');
      return fetchBackendPlanetCollection(address, { signal });
    },
    enabled: !!address,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (!address || !publicClient) return;
    let cancelled = false;

    const catchUp = async () => {
      if (running.current) return;
      running.current = true;
      try {
        const persisted = readPersistedPurchasedTickets(address).tickets;
        const localTickets: PurchasedTicket[] = persisted.flatMap((ticket) => {
          if (ticket.originTxHash === null || ticket.logIndex === null) return [];
          return [{
            ticketId: ticket.ticketId,
            drawingId: ticket.drawingId,
            normals: ticket.normals,
            bonusBall: ticket.bonusBall,
            originTxHash: ticket.originTxHash,
            logIndex: ticket.logIndex,
          }];
        });
        const [walletResult, pendingResult] = await Promise.allSettled([
          collectWalletTicketTransactionHashes(address, (wallet, options) => api.walletTickets(wallet, options)),
          Promise.resolve(readPendingPurchases(address)),
        ]);
        // A temporary Data API outage must not hide locally confirmed receipts.
        const walletHashes = walletResult.status === 'fulfilled' ? walletResult.value : [];
        const pendingHashes = pendingResult.status === 'fulfilled' ? pendingResult.value : [];
        if (cancelled) return;
        const tickets = await collectCanonicalReceiptTickets({
          address,
          localTickets,
          transactionHashes: [...walletHashes, ...pendingHashes, ...localTickets.map((ticket) => ticket.originTxHash)],
          getReceipt: (hash) => publicClient.getTransactionReceipt({ hash }),
        });
        if (cancelled || tickets.length === 0) return;
        const current = queryClient.getQueryData<BackendPlanetCollectionRow[]>(BACKEND_PLANETS_QUERY(address)) ?? [];
        const existingReady = new Set(
          current
            .filter((row) => row.generationStatus === 'generated' && row.planet)
            .map((row) => ticketKey(row.ticket)),
        );
        const missing = tickets.filter((ticket) => !existingReady.has(ticketKey(ticket)));
        if (missing.length === 0 || cancelled) return;
        for (let index = 0; index < missing.length; index += 50) {
          if (cancelled) return;
          await requestBackendPlanetGenerationBatch({
            recipient: address,
            tickets: missing.slice(index, index + 50),
          });
        }
        if (!cancelled) {
          await queryClient.invalidateQueries({ queryKey: BACKEND_PLANETS_QUERY(address) });
          await queryClient.invalidateQueries({
            queryKey: ['megastera-backend', BACKEND_API_BASE_URL, 'wallet-mining', address],
          });
        }
      } finally {
        running.current = false;
      }
    };

    void catchUp().catch(() => undefined);
    const interval = window.setInterval(() => void catchUp().catch(() => undefined), CATCH_UP_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [address, publicClient, queryClient]);

  return query;
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
