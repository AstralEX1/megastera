import { encodeAbiParameters, encodeEventTopics, getAddress, stringToHex, type Log, type TransactionReceipt } from 'viem';
import { describe, expect, it } from 'vitest';
import { BASE_CHAIN_ID, MEGASTERA_SOURCE } from './config.js';
import {
  BASE_JACKPOT,
  decodeEligibleTicket,
  findEligibleTicket,
  MegasteraVerifier,
  normalizeMegasteraProof,
  TICKET_PURCHASED_ABI,
} from './eligibility.js';

const recipient = '0x1111111111111111111111111111111111111111' as const;
const transactionHash = `0x${'ab'.repeat(32)}` as const;
const blockNumber = 30_000_000n;

function ticketLog(overrides: Partial<Log> = {}): Log {
  const source = stringToHex(MEGASTERA_SOURCE, { size: 32 });
  return {
    address: BASE_JACKPOT,
    blockNumber,
    transactionHash,
    logIndex: 4,
    topics: encodeEventTopics({
      abi: TICKET_PURCHASED_ABI,
      eventName: 'TicketPurchased',
      args: { recipient, currentDrawingId: 123n, source },
    }),
    data: encodeAbiParameters(
      [
        { name: 'userTicketId', type: 'uint256' },
        { name: 'normals', type: 'uint8[]' },
        { name: 'bonusball', type: 'uint8' },
        { name: 'referralScheme', type: 'bytes32' },
      ],
      [456n, [2, 7, 14, 22, 29], 9, `0x${'00'.repeat(32)}`],
    ),
    ...overrides,
  } as Log;
}

describe('Megastera eligibility', () => {
  it('decodes only a canonical Megastera purchase log', () => {
    expect(decodeEligibleTicket(ticketLog())).toEqual({
      recipient,
      ticketId: 456n,
      drawingId: 123n,
      normals: [2, 7, 14, 22, 29],
      bonusBall: 9,
      originTxHash: transactionHash,
      blockNumber,
      logIndex: 4n,
    });
  });

  it('rejects a ticket emitted by a non-canonical jackpot', () => {
    expect(() => decodeEligibleTicket(ticketLog({ address: '0x2222222222222222222222222222222222222222' }))).toThrow(
      /canonical Megastera purchase/i,
    );
  });

  it('locates the requested log index before decoding it', () => {
    const otherLog = ticketLog({ logIndex: 3 });
    expect(findEligibleTicket([otherLog, ticketLog()], 4).ticketId).toBe(456n);
    expect(() => findEligibleTicket([otherLog], 4)).toThrow('was not found in the receipt');
  });

  it('normalizes a receipt-backed Base mainnet Megastera proof', () => {
    const source = stringToHex(MEGASTERA_SOURCE, { size: 32 });
    const proof = normalizeMegasteraProof({
      ...decodeEligibleTicket(ticketLog()),
      chainId: BASE_CHAIN_ID,
      jackpotAddress: BASE_JACKPOT.toLowerCase() as `0x${string}`,
      source,
    });

    expect(proof).toMatchObject({
      chainId: BASE_CHAIN_ID,
      jackpotAddress: BASE_JACKPOT,
      recipient: getAddress(recipient),
      source,
      ticketId: 456n,
    });
    expect(() => normalizeMegasteraProof({ ...proof, chainId: 84_532 })).toThrow(/Base mainnet/i);
  });

  it('rejects a reverted, non-canonical, or wrong-recipient receipt', () => {
    const blockHash = `0x${'cd'.repeat(32)}` as `0x${string}`;
    const receipt = {
      status: 'success',
      transactionHash,
      blockHash,
      blockNumber,
      logs: [ticketLog({ blockHash, transactionHash })],
    } as unknown as TransactionReceipt;
    const verifier = new MegasteraVerifier();

    expect(verifier.verifyReceipt(receipt, { logIndex: 4, recipient })).toMatchObject({ ticketId: 456n });
    expect(() => verifier.verifyReceipt({ ...receipt, status: 'reverted' }, { logIndex: 4, recipient })).toThrow(/did not succeed/i);
    expect(() => verifier.verifyReceipt({ ...receipt, blockHash: undefined } as unknown as TransactionReceipt, { logIndex: 4, recipient })).toThrow(/finalized block/i);
    expect(() => verifier.verifyReceipt(receipt, { logIndex: 4, recipient: '0x2222222222222222222222222222222222222222' })).toThrow(/recipient/i);
    expect(() => verifier.verifyReceipt(receipt, { logIndex: 99, recipient })).toThrow(/was not found/i);
  });

  it('rejects the legacy source tag even when the receipt succeeded', () => {
    const blockHash = `0x${'cd'.repeat(32)}` as `0x${string}`;
    const log = ticketLog({
      blockHash,
      topics: encodeEventTopics({
        abi: TICKET_PURCHASED_ABI,
        eventName: 'TicketPurchased',
        args: {
          recipient,
          currentDrawingId: 123n,
          source: stringToHex('MEGAPLANETS_V1', { size: 32 }),
        },
      }) as Log['topics'],
    });
    const receipt = {
      status: 'success',
      transactionHash,
      blockHash,
      blockNumber,
      logs: [log],
    } as unknown as TransactionReceipt;

    expect(() => new MegasteraVerifier().verifyReceipt(receipt, { logIndex: 4, recipient })).toThrow(/MEGASTERA/i);
  });
});
