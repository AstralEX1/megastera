import { useQuery } from '@tanstack/react-query';
import { BACKEND_API_BASE_URL, backendApiFetch } from '@/lib/backendApi';

export type LeaderboardPeriod = {
  id: string;
  startsAt: string;
  endsAt: string;
  finalizedAt?: string | null;
};

export type LeaderboardRow = {
  rank: number;
  walletAddress: `0x${string}`;
  scoreMicros: string;
  effectiveMineralsPerDayMicros: string;
};

export type LeaderboardPage = {
  period: LeaderboardPeriod;
  asOf?: string;
  total: number;
  offset: number;
  limit: number;
  rows: LeaderboardRow[];
};

export type WalletLeaderboardPosition = {
  period: LeaderboardPeriod;
  asOf: string;
  row: LeaderboardRow | null;
  distanceToNextRankMicros: string | null;
};

export const LIVE_LEADERBOARD_REFRESH_INTERVAL_MS = 60_000;

async function readJson<T>(url: string, label: string): Promise<T> {
  const response = await backendApiFetch(url);
  if (!response.ok) throw new Error(`${label} returned HTTP ${response.status}.`);
  return response.json() as Promise<T>;
}

export function fetchCurrentLeaderboard(offset = 0, limit = 50): Promise<LeaderboardPage> {
  return readJson(`/api/leaderboard/current?offset=${offset}&limit=${limit}`, 'Leaderboard');
}

export function fetchWalletLeaderboardPosition(address: `0x${string}`): Promise<WalletLeaderboardPosition> {
  return readJson(`/api/leaderboard/current/${address}`, 'Wallet leaderboard position');
}

export function currentLeaderboardQueryOptions(offset = 0, limit = 50) {
  return {
    queryKey: ['megastera-backend', BACKEND_API_BASE_URL, 'leaderboard', 'current', offset, limit],
    queryFn: () => fetchCurrentLeaderboard(offset, limit),
    staleTime: LIVE_LEADERBOARD_REFRESH_INTERVAL_MS,
    refetchInterval: LIVE_LEADERBOARD_REFRESH_INTERVAL_MS,
  };
}
export function useCurrentLeaderboard(offset = 0, limit = 50) {
  return useQuery(currentLeaderboardQueryOptions(offset, limit));
}

export function useWalletLeaderboardPosition(address: `0x${string}` | undefined) {
  return useQuery({
    queryKey: ['megastera-backend', BACKEND_API_BASE_URL, 'leaderboard', 'current-wallet', address],
    queryFn: () => {
      if (!address) throw new Error('A connected wallet is required.');
      return fetchWalletLeaderboardPosition(address);
    },
    enabled: !!address,
    staleTime: LIVE_LEADERBOARD_REFRESH_INTERVAL_MS,
    refetchInterval: LIVE_LEADERBOARD_REFRESH_INTERVAL_MS,
  });
}
