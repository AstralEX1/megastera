import type { QueryClient } from '@tanstack/react-query';
import { API_BASE_URL, QK } from './api';
import { BACKEND_API_BASE_URL } from './backendApi';

/**
 * Invalidates browser reads that can change after a confirmed wallet write.
 *
 * Keep this list centralized: direct purchases, keeper executions, and claims
 * affect overlapping ticket and backend-Planet surfaces.
 */
export async function invalidatePostWriteQueries(
  queryClient: Pick<QueryClient, 'invalidateQueries'>,
): Promise<void> {
  const queryKeys = [
    [QK.NS, API_BASE_URL, QK.walletTicketsByRound],
    [QK.NS, API_BASE_URL, QK.walletTickets],
    [QK.NS, API_BASE_URL, QK.walletStats],
    [QK.NS, API_BASE_URL, QK.walletWins],
    ['megastera-backend', BACKEND_API_BASE_URL, 'planets'],
    ['megastera-backend', BACKEND_API_BASE_URL, 'wallet-mining'],
  ] as const;

  await Promise.all(
    queryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey: [...queryKey] })),
  );
}
