import {
  encodeAbiParameters,
  type Hex,
  keccak256,
  type Log,
  type TransactionReceipt,
  toBytes,
} from 'viem';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from './generated/prisma/client.js';
import {
  GALAXY_PULSE_JACKPOT_ADDRESS,
  GALAXY_PULSE_SCALED_ENTROPY_PROVIDER_ADDRESS,
  ingestGalaxyPulseRounds,
  runLeaderboardFinalization,
} from './leaderboardWorker.js';

const TRANSACTION_HASH = `0x${'11'.repeat(32)}` as Hex;
const BLOCK_HASH = `0x${'22'.repeat(32)}` as Hex;
const RANDOM_NUMBER = `0x${'aa'.repeat(32)}` as Hex;
const SETTLEMENT_BLOCK = 110n;
const FINALIZED_TO_BLOCK = 118n;
const BLOCK_TIMESTAMP = 1_787_000_000n;
const NOW = new Date('2026-08-22T18:00:00.000Z');

const JACKPOT_SETTLED_TOPIC = keccak256(
  toBytes('JackpotSettled(uint256,uint256,uint256,uint8,uint256,uint256)'),
);
const ENTROPY_FULFILLED_TOPIC = keccak256(toBytes('EntropyFulfilled(uint64,bytes32)'));

function makeLog(input: {
  address: string;
  topics: readonly Hex[];
  data: Hex;
  logIndex: number;
}): Log {
  return {
    address: input.address,
    blockHash: BLOCK_HASH,
    blockNumber: SETTLEMENT_BLOCK,
    data: input.data,
    logIndex: input.logIndex,
    removed: false,
    topics: input.topics,
    transactionHash: TRANSACTION_HASH,
    transactionIndex: 0,
  } as unknown as Log;
}

function makeSettlementLogs(): Log[] {
  return [
    makeLog({
      address: GALAXY_PULSE_JACKPOT_ADDRESS,
      topics: [JACKPOT_SETTLED_TOPIC, encodeAbiParameters([{ type: 'uint256' }], [42n])],
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
      logIndex: 0,
    }),
    makeLog({
      address: GALAXY_PULSE_SCALED_ENTROPY_PROVIDER_ADDRESS,
      topics: [ENTROPY_FULFILLED_TOPIC, encodeAbiParameters([{ type: 'uint64' }], [7n])],
      data: encodeAbiParameters([{ type: 'bytes32' }], [RANDOM_NUMBER]),
      logIndex: 1,
    }),
  ];
}

function makeReceipt(logs: readonly Log[]): TransactionReceipt {
  return {
    blockHash: BLOCK_HASH,
    blockNumber: SETTLEMENT_BLOCK,
    cumulativeGasUsed: 1n,
    effectiveGasPrice: 1n,
    from: GALAXY_PULSE_JACKPOT_ADDRESS,
    gasUsed: 1n,
    logs,
    logsBloom: `0x${'00'.repeat(256)}`,
    status: 'success',
    to: GALAXY_PULSE_JACKPOT_ADDRESS,
    transactionHash: TRANSACTION_HASH,
    transactionIndex: 0,
    type: 'eip1559',
  } as unknown as TransactionReceipt;
}

function makePrisma(cursorNextBlock = 100n, lastBlockHash: string | null = null) {
  const events: string[] = [];
  let cursor = {
    chainId: 8453,
    contractAddress: GALAXY_PULSE_JACKPOT_ADDRESS.toLowerCase(),
    stream: 'galaxy-pulse-rounds',
    nextBlock: cursorNextBlock,
    lastBlockHash,
  };
  const rounds = new Map<
    string,
    { drawingId: string; entropy: string; settlementTxHash: string; settledAt: Date }
  >();
  const indexerCursor = {
    findUnique: vi.fn(async () => cursor),
    upsert: vi.fn(
      async ({ create, update }: { create: typeof cursor; update: Partial<typeof cursor> }) => {
        events.push('cursor');
        cursor = { ...cursor, ...create, ...update };
        return cursor;
      },
    ),
  };
  const galaxyPulseRound = {
    findUnique: vi.fn(
      async ({ where }: { where: { drawingId: string } }) => rounds.get(where.drawingId) ?? null,
    ),
    create: vi.fn(
      async ({
        data,
      }: {
        data: { drawingId: string; entropy: string; settlementTxHash: string; settledAt: Date };
      }) => {
        events.push('persist');
        rounds.set(data.drawingId, data);
        return data;
      },
    ),
  };
  return {
    events,
    cursor: indexerCursor,
    rounds,
    prisma: { indexerCursor, galaxyPulseRound } as unknown as PrismaClient,
  };
}

function makeClient(logs = makeSettlementLogs()) {
  const receipt = makeReceipt(logs);
  return {
    getBlockNumber: vi.fn(async () => 120n),
    getLogs: vi.fn(async () => logs.filter((log) => log.address === GALAXY_PULSE_JACKPOT_ADDRESS)),
    getTransactionReceipt: vi.fn(async () => receipt),
    getBlock: vi.fn(async () => ({ hash: BLOCK_HASH, timestamp: BLOCK_TIMESTAMP })),
  };
}

const BASE_ENV = {
  BASE_RPC_URL: 'https://rpc.example.test',
  DATABASE_URL: 'postgresql://example.test/db',
};

describe('ingestGalaxyPulseRounds', () => {
  it('processes finalized logs before advancing the separate cursor', async () => {
    const { events, cursor, rounds, prisma } = makePrisma();
    const client = makeClient();

    await ingestGalaxyPulseRounds({
      prisma,
      startBlock: 100n,
      confirmations: 2n,
      rpcEndpoints: ['fixture'],
      makeClient: () => client,
    });

    expect(client.getLogs).toHaveBeenCalledWith(
      expect.objectContaining({
        address: GALAXY_PULSE_JACKPOT_ADDRESS,
        fromBlock: 100n,
        toBlock: FINALIZED_TO_BLOCK,
      }),
    );
    expect(client.getTransactionReceipt).toHaveBeenCalledWith({ hash: TRANSACTION_HASH });
    expect(client.getBlock).toHaveBeenCalledWith({ blockNumber: SETTLEMENT_BLOCK });
    expect(events).toEqual(['persist', 'cursor']);
    expect(rounds.get('42')).toEqual({
      drawingId: '42',
      entropy: RANDOM_NUMBER,
      settlementTxHash: TRANSACTION_HASH,
      settledAt: new Date(Number(BLOCK_TIMESTAMP) * 1_000),
    });
    expect(cursor.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { nextBlock: 119n, lastBlockHash: BLOCK_HASH },
      }),
    );
  });

  it('does not advance the cursor when receipt verification fails', async () => {
    const { events, cursor, prisma } = makePrisma();
    const client = makeClient(makeSettlementLogs().slice(0, 1));

    await expect(
      ingestGalaxyPulseRounds({
        prisma,
        startBlock: 100n,
        confirmations: 2n,
        rpcEndpoints: ['fixture'],
        makeClient: () => client,
      }),
    ).rejects.toThrow(/EntropyFulfilled/i);

    expect(events).toEqual([]);
    expect(cursor.upsert).not.toHaveBeenCalled();
  });

  it('fails closed when the persisted cursor provenance is no longer canonical', async () => {
    const { cursor, prisma } = makePrisma(100n, `0x${'33'.repeat(32)}`);
    const client = makeClient();

    await expect(
      ingestGalaxyPulseRounds({
        prisma,
        startBlock: 90n,
        confirmations: 2n,
        rpcEndpoints: ['fixture'],
        makeClient: () => client,
      }),
    ).rejects.toThrow(/cursor.*canonical/i);

    expect(cursor.upsert).not.toHaveBeenCalled();
  });
});

describe('runLeaderboardFinalization', () => {
  it('keeps legacy mode free of Pulse scan and freshness calls', async () => {
    const events: string[] = [];
    await runLeaderboardFinalization(BASE_ENV, {
      prisma: {} as PrismaClient,
      now: NOW,
      assertFresh: async () => {
        events.push('fresh');
      },
      finalize: async () => {
        events.push('finalize');
      },
    });

    expect(events).toEqual(['finalize']);
  });

  it('runs freshness before finalization when Pulse is enabled', async () => {
    const events: string[] = [];
    await runLeaderboardFinalization(
      {
        ...BASE_ENV,
        GALAXY_PULSE_START_BLOCK: '1000',
      },
      {
        prisma: {} as PrismaClient,
        now: NOW,
        assertFresh: async () => {
          events.push('fresh');
        },
        finalize: async () => {
          events.push('finalize');
        },
        makeClient: () => makeClient(),
      },
    );

    expect(events).toEqual(['fresh', 'finalize']);
  });

  it('does not finalize when Pulse freshness fails', async () => {
    const finalize = vi.fn();
    await expect(
      runLeaderboardFinalization(
        {
          ...BASE_ENV,
          GALAXY_PULSE_START_BLOCK: '1000',
        },
        {
          prisma: {} as PrismaClient,
          now: NOW,
          assertFresh: async () => {
            throw new Error('stale Pulse');
          },
          finalize,
          makeClient: () => makeClient(),
        },
      ),
    ).rejects.toThrow('stale Pulse');

    expect(finalize).not.toHaveBeenCalled();
  });
});
