import { describe, expect, it } from 'vitest';
import { assertReceiptFinality } from './receiptVerification.js';

describe('receipt verification', () => {
  it('requires confirmation depth and canonical block hash', () => {
    expect(() => assertReceiptFinality(
      { blockNumber: 100n, blockHash: '0xaaa' },
      { latestBlock: 105n, canonicalBlockHash: '0xaaa', confirmations: 6n },
    )).toThrow(/confirmations/i);

    expect(() => assertReceiptFinality(
      { blockNumber: 100n, blockHash: '0xaaa' },
      { latestBlock: 106n, canonicalBlockHash: '0xbbb', confirmations: 6n },
    )).toThrow(/canonical/i);
  });
});
