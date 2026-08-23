import { describe, expect, it } from 'vitest';
import { assertReceiptFinality, parseReceiptReference } from './receiptVerification.js';

const transactionHash = `0x${'ab'.repeat(32)}` as const;
const recipient = '0x1111111111111111111111111111111111111111' as const;

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

  it('narrows an optional recipient before normalizing a receipt reference', () => {
    expect(parseReceiptReference({ transactionHash, logIndex: 4, recipient })).toEqual({
      transactionHash,
      logIndex: 4,
      recipient,
    });
    expect(parseReceiptReference({ transactionHash, logIndex: 4, recipient: 123 })).toBeUndefined();
  });
});
