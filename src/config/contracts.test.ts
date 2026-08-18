import { stringToHex } from 'viem';
import { describe, expect, it } from 'vitest';
import { CHAIN, DEFAULT_REFERRER_ADDRESS, REFERRAL_SPLIT_FULL, REFERRER_ADDRESS, TICKET_SOURCE } from './contracts';

describe('Megapot contract invariants', () => {
  it('defaults a fresh checkout to Base mainnet', () => {
    expect(CHAIN).toBe('mainnet');
  });

  it('keeps the canonical source tag and referral split', () => {
    expect(TICKET_SOURCE).toBe(stringToHex('MEGASTERA', { size: 32 }));
    expect(REFERRAL_SPLIT_FULL).toEqual([1_000_000_000_000_000_000n]);
    expect(REFERRER_ADDRESS).toBe(DEFAULT_REFERRER_ADDRESS);
  });
});
