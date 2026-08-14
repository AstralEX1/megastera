import { describe, expect, it } from 'vitest';
import { assertReceiptFinality, findTicketFromReceipt } from './receiptVerification';

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

  it('rejects a Base Sepolia RPC before reading a receipt', async () => {
    const makeClient = () => ({ getChainId: async () => 84_532 }) as never;
    await expect(
      findTicketFromReceipt(
        {
          rpcUrl: 'https://rpc.example',
          confirmations: 6n,
        },
        {
          transactionHash: `0x${'ab'.repeat(32)}`,
          logIndex: 0,
        },
        makeClient,
      ),
    ).rejects.toThrow('Receipt RPC is not Base mainnet.');
  });
});
