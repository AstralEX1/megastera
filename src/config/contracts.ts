/**
 * ---
 * @skill      https://llms.megapot.io/contracts/reference
 * The checked-in value is the approved Megastera referrer; never replace it
 * with a dead address. Base mainnet is the only target.
 * ---
 *
 * All Megapot contract addresses and explorer helpers. Every hook reads this
 * mainnet-only source of truth.
 */

import { type Address, stringToHex } from 'viem';
import { base } from 'viem/chains';

export const CHAIN = 'mainnet' as const;

export const VIEM_CHAIN = base;

/**
 * Block explorer for the active chain. Address and transaction prefixes are derived
 * from a single base map:
 *   `${EXPLORER_ADDRESS_URL}${addr}` → e.g. https://basescan.org/address/0x...
 *   `${EXPLORER_TX_URL}${hash}`      → e.g. https://basescan.org/tx/0x...
 */
const EXPLORER_BASE = 'https://basescan.org/';

/** Chain-resolved explorer URL prefix for addresses. Append the address. */
export const EXPLORER_ADDRESS_URL = `${EXPLORER_BASE}address/`;

/** Chain-resolved explorer URL prefix for transactions. Append the tx hash. */
export const EXPLORER_TX_URL = `${EXPLORER_BASE}tx/`;

/** USDC has 6 decimals on every chain Megapot deploys to. */
export const USDC_DECIMALS = 6;

/**
 * Per-drawing bonusball minimum. The protocol default is 1; per-drawing maxes
 * (`ballMax`, `bonusballMax`) come from `Jackpot.getDrawingState`. Override
 * here if a fork uses a different protocol configuration.
 */
export const BONUSBALL_MIN = 1;

/**
 * `bytes32` source identifier passed to ticket purchase calls (direct buys and
 * batch orders) for analytics attribution. It is part of the eligibility
 * invariant and must remain unchanged.
 *
 * Computed from a UTF-8 string padded to 32 bytes via `viem.stringToHex`.
 */
export const TICKET_SOURCE = stringToHex('MEGASTERA', { size: 32 });

/**
 * Referral split weights — must sum to 1e18 (= 100%). Single referrer = `[1e18]`.
 * Up to 5 entries; align order with `_referrers`.
 */
export const REFERRAL_SPLIT_FULL: readonly bigint[] = [1_000_000_000_000_000_000n];

/**
 * Approved wallet that earns referral fees on every ticket purchased and
 * every winning claimed through this app.
 *
 * Per-ticket fee + win-share rates are protocol-level and readable at
 * runtime via `Jackpot.getDrawingState().referralFee` and
 * `.referralWinShare` (both 1e18-scaled).
 *
 * @see https://llms.megapot.io/tasks/claim-referral-fees
 */
export const DEFAULT_REFERRER_ADDRESS: Address = '0x43904de0e226cc20DD72968954af6B439404743D';
export const REFERRER_ADDRESS: Address = DEFAULT_REFERRER_ADDRESS;

export const USDC_ADDRESS: Address = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
export const JACKPOT_ADDRESS: Address = '0x3bAe643002069dBCbcd62B1A4eb4C4A397d042a2';
export const BATCH_PURCHASE_FACILITATOR_ADDRESS: Address =
  '0xBA343479D98a1Ed333899999D95a7343B808a76F';
export const PAYOUT_CALCULATOR_ADDRESS: Address =
  '0x97a22361b6208aC8cd9afaea09D20feC47046CBD';
