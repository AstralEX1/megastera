import {
  encodeAbiParameters,
  type Hex,
  keccak256,
  type Log,
  type TransactionReceipt,
  toBytes,
} from 'viem';
import { describe, expect, it } from 'vitest';
import {
  decodeGalaxyPulseSettlementReceipt,
  type GalaxyPulseRound,
  type GalaxyPulseRoundStore,
  persistGalaxyPulseRound,
} from './galaxyPulseIndexer.js';

const JACKPOT_ADDRESS = '0x1111111111111111111111111111111111111111' as const;
const ENTROPY_PROVIDER_ADDRESS = '0x2222222222222222222222222222222222222222' as const;
const WRONG_ADDRESS = '0x3333333333333333333333333333333333333333' as const;
const TRANSACTION_HASH = `0x${'11'.repeat(32)}` as Hex;
const BLOCK_HASH = `0x${'22'.repeat(32)}` as Hex;
const RANDOM_NUMBER = `0x${'aa'.repeat(32)}` as Hex;
const DRAWING_ID = 42n;
const BLOCK_NUMBER = 123_456n;
const BLOCK_TIMESTAMP = new Date('2026-08-22T12:34:56.000Z');

function eventTopic(signature: string): Hex {
  return keccak256(toBytes(signature));
}

function makeLog(input: {
  address: string;
  data: Hex;
  topics: readonly Hex[];
  logIndex: number;
}): Log {
  return {
    address: input.address,
    blockHash: BLOCK_HASH,
    blockNumber: BLOCK_NUMBER,
    data: input.data,
    logIndex: input.logIndex,
    removed: false,
    topics: input.topics,
    transactionHash: TRANSACTION_HASH,
    transactionIndex: 0,
    blockTimestamp: undefined,
  } as unknown as Log;
}

function makeJackpotSettledLog(
  overrides: Partial<{ address: string; drawingId: bigint; logIndex: number }> = {},
): Log {
  const drawingId = overrides.drawingId ?? DRAWING_ID;
  return makeLog({
    address: overrides.address ?? JACKPOT_ADDRESS,
    logIndex: overrides.logIndex ?? 0,
    topics: [
      eventTopic('JackpotSettled(uint256,uint256,uint256,uint8,uint256,uint256)'),
      encodeAbiParameters([{ type: 'uint256' }], [drawingId]),
    ],
    data: encodeAbiParameters(
      [
        { type: 'uint256' },
        { type: 'uint256' },
        { type: 'uint8' },
        { type: 'uint256' },
        { type: 'uint256' },
      ],
      [100n, 200n, 5, 0x1234n, 300n],
    ),
  });
}

function makeEntropyFulfilledLog(
  overrides: Partial<{ address: string; randomNumber: Hex; logIndex: number }> = {},
): Log {
  return makeLog({
    address: overrides.address ?? ENTROPY_PROVIDER_ADDRESS,
    logIndex: overrides.logIndex ?? 1,
    topics: [
      eventTopic('EntropyFulfilled(uint64,bytes32)'),
      encodeAbiParameters([{ type: 'uint64' }], [7n]),
    ],
    data: encodeAbiParameters([{ type: 'bytes32' }], [overrides.randomNumber ?? RANDOM_NUMBER]),
  });
}

function makeReceipt(logs: readonly Log[]): TransactionReceipt {
  return {
    blockHash: BLOCK_HASH,
    blockNumber: BLOCK_NUMBER,
    cumulativeGasUsed: 1n,
    effectiveGasPrice: 1n,
    from: JACKPOT_ADDRESS,
    gasUsed: 1n,
    logs,
    logsBloom: `0x${'00'.repeat(256)}`,
    status: 'success',
    to: JACKPOT_ADDRESS,
    transactionHash: TRANSACTION_HASH,
    transactionIndex: 0,
    type: 'eip1559',
  } as unknown as TransactionReceipt;
}

function validSettlement(): GalaxyPulseRound {
  return {
    drawingId: DRAWING_ID,
    entropy: RANDOM_NUMBER,
    settlementTxHash: TRANSACTION_HASH,
    settledAt: BLOCK_TIMESTAMP,
  };
}

function makeStore() {
  const rows = new Map<string, GalaxyPulseRound>();
  const store: GalaxyPulseRoundStore = {
    async findByDrawingId(drawingId) {
      return rows.get(drawingId.toString()) ?? null;
    },
    async create(round) {
      rows.set(round.drawingId.toString(), round);
      return round;
    },
  };
  return { rows, store };
}

describe('decodeGalaxyPulseSettlementReceipt', () => {
  it('extracts the drawing, raw entropy, transaction hash, and block timestamp', () => {
    const result = decodeGalaxyPulseSettlementReceipt({
      receipt: makeReceipt([makeJackpotSettledLog(), makeEntropyFulfilledLog()]),
      jackpotAddress: JACKPOT_ADDRESS,
      scaledEntropyProviderAddress: ENTROPY_PROVIDER_ADDRESS,
      blockTimestamp: BLOCK_TIMESTAMP,
    });

    expect(result).toEqual(validSettlement());
  });

  it('rejects an ambiguous receipt with more than one settlement event', () => {
    expect(() =>
      decodeGalaxyPulseSettlementReceipt({
        receipt: makeReceipt([
          makeJackpotSettledLog(),
          makeJackpotSettledLog({ logIndex: 2 }),
          makeEntropyFulfilledLog(),
        ]),
        jackpotAddress: JACKPOT_ADDRESS,
        scaledEntropyProviderAddress: ENTROPY_PROVIDER_ADDRESS,
        blockTimestamp: 1n,
      }),
    ).toThrow(/exactly one JackpotSettled/i);
  });

  it.each([
    [
      'JackpotSettled',
      makeJackpotSettledLog({ address: WRONG_ADDRESS }),
      makeEntropyFulfilledLog(),
    ],
    [
      'EntropyFulfilled',
      makeJackpotSettledLog(),
      makeEntropyFulfilledLog({ address: WRONG_ADDRESS }),
    ],
  ])('rejects %s emitted by an unexpected address', (_name, settlementLog, entropyLog) => {
    expect(() =>
      decodeGalaxyPulseSettlementReceipt({
        receipt: makeReceipt([settlementLog, entropyLog]),
        jackpotAddress: JACKPOT_ADDRESS,
        scaledEntropyProviderAddress: ENTROPY_PROVIDER_ADDRESS,
        blockTimestamp: 1n,
      }),
    ).toThrow(/unexpected|expected/i);
  });
});

describe('persistGalaxyPulseRound', () => {
  it('returns the existing row on an identical replay', async () => {
    const { rows, store } = makeStore();
    const first = await persistGalaxyPulseRound(store, validSettlement());
    const replay = await persistGalaxyPulseRound(store, { ...validSettlement() });

    expect(replay).toBe(first);
    expect(rows.size).toBe(1);
  });

  it.each([
    ['entropy', { entropy: `0x${'bb'.repeat(32)}` as Hex }],
    ['transaction hash', { settlementTxHash: `0x${'33'.repeat(32)}` as Hex }],
  ])('fails closed when a replay conflicts on %s', async (_field, conflict) => {
    const { store } = makeStore();
    await persistGalaxyPulseRound(store, validSettlement());

    await expect(
      persistGalaxyPulseRound(store, { ...validSettlement(), ...conflict }),
    ).rejects.toThrow(/conflict/i);
  });
});
