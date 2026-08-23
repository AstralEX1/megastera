import {
  type Address,
  decodeEventLog,
  getAddress,
  type Hex,
  isHash,
  keccak256,
  type Log,
  type TransactionReceipt,
  toBytes,
} from 'viem';
import { deriveGalaxyPulseSeed } from './galaxyPulse.js';

export const JACKPOT_SETTLED_ABI = [
  {
    type: 'event',
    name: 'JackpotSettled',
    inputs: [
      { indexed: true, name: 'drawingId', type: 'uint256' },
      { indexed: false, name: 'totalTicketsSold', type: 'uint256' },
      { indexed: false, name: 'userWinnings', type: 'uint256' },
      { indexed: false, name: 'winningBonusball', type: 'uint8' },
      { indexed: false, name: 'winningNumbers', type: 'uint256' },
      { indexed: false, name: 'newDrawingAccumulator', type: 'uint256' },
    ],
  },
] as const;

const JACKPOT_SETTLED_TOPIC = keccak256(
  toBytes('JackpotSettled(uint256,uint256,uint256,uint8,uint256,uint256)'),
);

export type GalaxyPulseRound = {
  drawingId: bigint;
  seed: Hex;
  settlementTxHash: Hex;
  settledAt: Date;
};

export type GalaxyPulseRoundStore = {
  findByDrawingId(drawingId: bigint): Promise<GalaxyPulseRound | null>;
  create(round: GalaxyPulseRound): Promise<GalaxyPulseRound>;
};

export type GalaxyPulseSettlementReceiptInput = {
  receipt: TransactionReceipt;
  jackpotAddress: Address;
  /** Block timestamps returned by viem are Unix seconds; Date is accepted for tests/adapters. */
  blockTimestamp: bigint | number | Date;
};

function receiptProvenance(receipt: TransactionReceipt): {
  transactionHash: Hex;
  blockHash: Hex;
  blockNumber: bigint;
} {
  if (receipt.status !== 'success')
    throw new Error('Galaxy Pulse settlement receipt did not succeed.');
  if (
    typeof receipt.transactionHash !== 'string' ||
    !isHash(receipt.transactionHash) ||
    typeof receipt.blockHash !== 'string' ||
    !isHash(receipt.blockHash) ||
    typeof receipt.blockNumber !== 'bigint'
  ) {
    throw new Error('Galaxy Pulse settlement receipt has incomplete block provenance.');
  }
  return {
    transactionHash: receipt.transactionHash,
    blockHash: receipt.blockHash,
    blockNumber: receipt.blockNumber,
  };
}

function assertLogProvenance(log: Log, provenance: ReturnType<typeof receiptProvenance>): void {
  if (
    log.transactionHash &&
    log.transactionHash.toLowerCase() !== provenance.transactionHash.toLowerCase()
  ) {
    throw new Error('Galaxy Pulse event log transaction hash is not canonical.');
  }
  if (log.blockHash && log.blockHash.toLowerCase() !== provenance.blockHash.toLowerCase()) {
    throw new Error('Galaxy Pulse event log block hash is not canonical.');
  }
  if (
    log.blockNumber !== undefined &&
    log.blockNumber !== null &&
    log.blockNumber !== provenance.blockNumber
  ) {
    throw new Error('Galaxy Pulse event log block number is not canonical.');
  }
}

function findExactlyOneEvent(
  receipt: TransactionReceipt,
  topic: Hex,
  label: string,
  expectedAddress: Address,
  provenance: ReturnType<typeof receiptProvenance>,
): Log {
  const matchingLogs = receipt.logs.filter(
    (log) => log.topics[0]?.toLowerCase() === topic.toLowerCase(),
  );
  if (matchingLogs.length !== 1) {
    throw new Error(`Galaxy Pulse receipt must contain exactly one ${label} event.`);
  }
  const [log] = matchingLogs;
  if (!log || getAddress(log.address) !== getAddress(expectedAddress)) {
    throw new Error(`Galaxy Pulse ${label} event was emitted by an unexpected address.`);
  }
  assertLogProvenance(log, provenance);
  return log;
}

function blockTimestampDate(value: bigint | number | Date): Date {
  if (value instanceof Date) {
    const milliseconds = value.getTime();
    if (!Number.isSafeInteger(milliseconds) || milliseconds < 0) {
      throw new Error('Galaxy Pulse block timestamp is invalid.');
    }
    return new Date(milliseconds);
  }
  if (
    (typeof value !== 'bigint' && typeof value !== 'number') ||
    value < 0 ||
    (typeof value === 'number' && !Number.isSafeInteger(value))
  ) {
    throw new Error('Galaxy Pulse block timestamp is invalid.');
  }
  const seconds = typeof value === 'bigint' ? value : BigInt(value);
  const maxSeconds = BigInt(Math.floor(Number.MAX_SAFE_INTEGER / 1_000));
  if (seconds > maxSeconds) throw new Error('Galaxy Pulse block timestamp is invalid.');
  return new Date(Number(seconds) * 1_000);
}

/** Decodes one finalized JackpotSettled receipt and derives its Galaxy Pulse seed. */
export function decodeGalaxyPulseSettlementReceipt(
  input: GalaxyPulseSettlementReceiptInput,
): GalaxyPulseRound {
  const provenance = receiptProvenance(input.receipt);
  const settledLog = findExactlyOneEvent(
    input.receipt,
    JACKPOT_SETTLED_TOPIC,
    'JackpotSettled',
    input.jackpotAddress,
    provenance,
  );
  const settled = decodeEventLog({
    abi: JACKPOT_SETTLED_ABI,
    eventName: 'JackpotSettled',
    data: settledLog.data,
    topics: settledLog.topics,
  });
  return {
    drawingId: settled.args.drawingId,
    seed: deriveGalaxyPulseSeed({
      drawingId: settled.args.drawingId,
      winningNumbers: settled.args.winningNumbers,
    }),
    settlementTxHash: provenance.transactionHash,
    settledAt: blockTimestampDate(input.blockTimestamp),
  };
}

/** Inserts once, reuses exact replays, and rejects any drawing conflict. */
export async function persistGalaxyPulseRound(
  store: GalaxyPulseRoundStore,
  round: GalaxyPulseRound,
): Promise<GalaxyPulseRound> {
  if (!isHash(round.seed) || !isHash(round.settlementTxHash)) {
    throw new Error('Galaxy Pulse round hash is invalid.');
  }
  const existing = await store.findByDrawingId(round.drawingId);
  if (!existing) return store.create(round);
  if (
    existing.seed.toLowerCase() !== round.seed.toLowerCase() ||
    existing.settlementTxHash.toLowerCase() !== round.settlementTxHash.toLowerCase()
  ) {
    throw new Error(`Galaxy Pulse round conflict for drawing ${round.drawingId.toString()}.`);
  }
  return existing;
}
