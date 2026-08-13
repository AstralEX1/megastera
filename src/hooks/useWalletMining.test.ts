import { describe, expect, it } from 'vitest';
import { MINING_REFRESH_INTERVAL_MS, walletMiningQueryOptions } from './useWalletMining';

describe('wallet mining refresh', () => {
  it('refetches the dynamic mining snapshot every 60 seconds', () => {
    expect(MINING_REFRESH_INTERVAL_MS).toBe(60_000);
    expect(walletMiningQueryOptions('0x1111111111111111111111111111111111111111').refetchInterval).toBe(60_000);
    expect(walletMiningQueryOptions('0x1111111111111111111111111111111111111111').staleTime).toBe(60_000);
  });
});
