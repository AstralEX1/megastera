import { stringToHex } from 'viem';
import { describe, expect, it } from 'vitest';
import {
  BATCH_PURCHASE_FACILITATOR_ADDRESS,
  CHAIN,
  DEFAULT_REFERRER_ADDRESS,
  JACKPOT_ADDRESS,
  REFERRAL_SPLIT_FULL,
  REFERRER_ADDRESS,
  TICKET_SOURCE,
  USDC_ADDRESS,
  VIEM_CHAIN,
} from './contracts';

describe('Megapot contract invariants', () => {
  it('uses the canonical Base mainnet deployment', () => {
    expect(CHAIN).toBe('mainnet');
    expect(VIEM_CHAIN.id).toBe(8453);
    expect(USDC_ADDRESS).toBe('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
    expect(JACKPOT_ADDRESS).toBe('0x3bAe643002069dBCbcd62B1A4eb4C4A397d042a2');
    expect(BATCH_PURCHASE_FACILITATOR_ADDRESS).toBe(
      '0xBA343479D98a1Ed333899999D95a7343B808a76F',
    );
  });

  it('keeps the canonical source tag and referral split', () => {
    expect(TICKET_SOURCE).toBe(stringToHex('MEGASTERA', { size: 32 }));
    expect(REFERRAL_SPLIT_FULL).toEqual([1_000_000_000_000_000_000n]);
    expect(REFERRER_ADDRESS).toBe(DEFAULT_REFERRER_ADDRESS);
    expect(DEFAULT_REFERRER_ADDRESS).toBe('0x43904de0e226cc20DD72968954af6B439404743D');
  });
});
