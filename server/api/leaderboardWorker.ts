import {
  type Address,
  createPublicClient,
  getAddress,
  type Hex,
  http,
  isHash,
  keccak256,
  type Log,
  type TransactionReceipt,
  toBytes,
} from 'viem';
import { base } from 'viem/chains';
import { loadBackendPlanetConfig } from './backendConfig.js';
import { BASE_CHAIN_ID } from './config.js';
import { BASE_JACKPOT } from './eligibility.js';
import { getPrismaClient } from './database.js';
import { assertGalaxyPulseFresh } from './galaxyPulseFreshness.js';
import {
  decodeGalaxyPulseSettlementReceipt,
  type GalaxyPulseRound,
  type GalaxyPulseRoundStore,
  persistGalaxyPulseRound,
} from './galaxyPulseIndexer.js';
import { ensureOverdueLeaderboardPeriodsFinalized } from './leaderboardStore.js';
import { getLogsAdaptive, readWithRpcFallback } from './rpc.js';

export const GALAXY_PULSE_JACKPOT_ADDRESS = BASE_JACKPOT;
export const GALAXY_PULSE_CURSOR_STREAM = 'galaxy-pulse-rounds';

const JACKPOT_SETTLED_TOPIC = keccak256(
  toBytes('JackpotSettled(uint256,uint256,uint256,uint8,uint256,uint256)'),
);

type GalaxyPulseRpcClient = {
  getBlockNumber(): Promise<bigint>;
  getLogs(args: {
    address: Address;
    topics: readonly Hex[];
    fromBlock: bigint;
    toBlock: bigint;
  }): Promise<readonly Log[]>;
  getTransactionReceipt(args: { hash: Hex }): Promise<TransactionReceipt>;
  getBlock(args: { blockNumber: bigint }): Promise<{ hash: Hex | null; timestamp: bigint }>;
};

type GalaxyPulseCursor = {
  nextBlock: bigint;
  lastBlockHash: string | null;
};

type GalaxyPulsePrisma = {
  indexerCursor: {
    findUnique(args: unknown): Promise<GalaxyPulseCursor | null>;
    upsert(args: unknown): Promise<GalaxyPulseCursor>;
  };
  galaxyPulseRound: {
    findUnique(args: unknown): Promise<{
      drawingId: { toString(): string } | bigint | string;
      seed: string;
      settlementTxHash: string;
      settledAt: Date;
    } | null>;
    create(args: unknown): Promise<{
      drawingId: { toString(): string } | bigint | string;
      seed: string;
      settlementTxHash: string;
      settledAt: Date;
    }>;
  };
};

export type GalaxyPulseIngestOptions = {
  prisma: import('./generated/prisma/client.js').PrismaClient;
  startBlock: bigint;
  confirmations: bigint;
  rpcEndpoints: readonly string[];
  jackpotAddress?: Address;
  makeClient?: (rpcUrl: string) => GalaxyPulseRpcClient;
};

export type LeaderboardWorkerDependencies = {
  prisma?: import('./generated/prisma/client.js').PrismaClient;
  now?: Date;
  makeClient?: (rpcUrl: string) => GalaxyPulseRpcClient;
  assertFresh?: typeof assertGalaxyPulseFresh;
  finalize?: typeof ensureOverdueLeaderboardPeriodsFinalized;
};

function asGalaxyPulsePrisma(
  prisma: import('./generated/prisma/client.js').PrismaClient,
): GalaxyPulsePrisma {
  return prisma as unknown as GalaxyPulsePrisma;
}

function asRound(
  row: Awaited<ReturnType<GalaxyPulsePrisma['galaxyPulseRound']['create']>>,
): GalaxyPulseRound {
  return {
    drawingId: BigInt(row.drawingId.toString()),
    seed: row.seed as Hex,
    settlementTxHash: row.settlementTxHash as Hex,
    settledAt: row.settledAt,
  };
}

function makeGalaxyPulseRoundStore(prisma: GalaxyPulsePrisma): GalaxyPulseRoundStore {
  return {
    async findByDrawingId(drawingId) {
      const row = await prisma.galaxyPulseRound.findUnique({
        where: { drawingId: drawingId.toString() },
      });
      return row ? asRound(row) : null;
    },
    async create(round) {
      const row = await prisma.galaxyPulseRound.create({
        data: {
          drawingId: round.drawingId.toString(),
          seed: round.seed,
          settlementTxHash: round.settlementTxHash,
          settledAt: round.settledAt,
        },
      });
      return asRound(row);
    },
  };
}

function defaultGalaxyPulseClient(rpcUrl: string): GalaxyPulseRpcClient {
  return createPublicClient({
    chain: base,
    transport: http(rpcUrl),
  }) as unknown as GalaxyPulseRpcClient;
}

async function ingestGalaxyPulseOnClient(
  options: Omit<GalaxyPulseIngestOptions, 'rpcEndpoints' | 'makeClient'> & {
    client: GalaxyPulseRpcClient;
    jackpotAddress: Address;
  },
): Promise<void> {
  if (options.confirmations < 0n)
    throw new Error('Galaxy Pulse confirmations must be non-negative.');
  const latestBlock = await options.client.getBlockNumber();
  if (latestBlock < options.confirmations) return;
  const toBlock = latestBlock - options.confirmations;
  if (options.startBlock > toBlock) return;
  const pulsePrisma = asGalaxyPulsePrisma(options.prisma);
  const cursor = await pulsePrisma.indexerCursor.findUnique({
    where: {
      chainId_contractAddress_stream: {
        chainId: BASE_CHAIN_ID,
        contractAddress: options.jackpotAddress.toLowerCase(),
        stream: GALAXY_PULSE_CURSOR_STREAM,
      },
    },
  });
  if (cursor?.lastBlockHash && cursor.nextBlock > options.startBlock) {
    const previous = await options.client.getBlock({ blockNumber: cursor.nextBlock - 1n });
    if (!previous.hash || previous.hash.toLowerCase() !== cursor.lastBlockHash.toLowerCase()) {
      throw new Error('Galaxy Pulse cursor is no longer canonical.');
    }
  }
  const fromBlock =
    cursor && cursor.nextBlock > options.startBlock ? cursor.nextBlock : options.startBlock;
  if (fromBlock > toBlock) return;

  const logs = await getLogsAdaptive({ fromBlock, toBlock }, (rangeFrom, rangeTo) =>
    options.client.getLogs({
      address: options.jackpotAddress,
      topics: [JACKPOT_SETTLED_TOPIC],
      fromBlock: rangeFrom,
      toBlock: rangeTo,
    }),
  );
  const orderedLogs = [...logs].sort((left, right) => {
    const leftBlock = left.blockNumber ?? 0n;
    const rightBlock = right.blockNumber ?? 0n;
    return leftBlock === rightBlock
      ? Number(left.logIndex) - Number(right.logIndex)
      : leftBlock < rightBlock
        ? -1
        : 1;
  });
  const roundStore = makeGalaxyPulseRoundStore(pulsePrisma);
  for (const log of orderedLogs) {
    if (getAddress(log.address) !== options.jackpotAddress) {
      throw new Error('Galaxy Pulse settlement log was emitted by an unexpected address.');
    }
    if (
      log.blockNumber !== undefined &&
      log.blockNumber !== null &&
      (log.blockNumber < fromBlock || log.blockNumber > toBlock)
    ) {
      throw new Error('Galaxy Pulse settlement log is outside the finalized scan range.');
    }
    if (!log.transactionHash || !isHash(log.transactionHash)) {
      throw new Error('Galaxy Pulse settlement log has no valid transaction hash.');
    }
    const receipt = await options.client.getTransactionReceipt({ hash: log.transactionHash });
    if (
      !isHash(receipt.transactionHash) ||
      receipt.transactionHash.toLowerCase() !== log.transactionHash.toLowerCase() ||
      typeof receipt.blockNumber !== 'bigint' ||
      !isHash(receipt.blockHash)
    ) {
      throw new Error('Galaxy Pulse receipt provenance does not match the settlement log.');
    }
    if (
      receipt.blockNumber < fromBlock ||
      receipt.blockNumber > toBlock ||
      (log.blockNumber !== undefined &&
        log.blockNumber !== null &&
        log.blockNumber !== receipt.blockNumber) ||
      (log.blockHash !== undefined &&
        log.blockHash !== null &&
        (!isHash(log.blockHash) || log.blockHash.toLowerCase() !== receipt.blockHash.toLowerCase()))
    ) {
      throw new Error('Galaxy Pulse receipt is not finalized at the scan boundary.');
    }
    const block = await options.client.getBlock({ blockNumber: receipt.blockNumber });
    if (
      !block.hash ||
      !isHash(block.hash) ||
      !isHash(receipt.blockHash) ||
      block.hash.toLowerCase() !== receipt.blockHash.toLowerCase()
    ) {
      throw new Error('Galaxy Pulse receipt block is no longer canonical.');
    }
    const round = decodeGalaxyPulseSettlementReceipt({
      receipt,
      jackpotAddress: options.jackpotAddress,
      blockTimestamp: block.timestamp,
    });
    await persistGalaxyPulseRound(roundStore, round);
  }

  const cursorBlock = await options.client.getBlock({ blockNumber: toBlock });
  if (!cursorBlock.hash || !isHash(cursorBlock.hash)) {
    throw new Error('Galaxy Pulse cursor boundary block has no canonical hash.');
  }
  await pulsePrisma.indexerCursor.upsert({
    where: {
      chainId_contractAddress_stream: {
        chainId: BASE_CHAIN_ID,
        contractAddress: options.jackpotAddress.toLowerCase(),
        stream: GALAXY_PULSE_CURSOR_STREAM,
      },
    },
    create: {
      chainId: BASE_CHAIN_ID,
      contractAddress: options.jackpotAddress.toLowerCase(),
      stream: GALAXY_PULSE_CURSOR_STREAM,
      nextBlock: toBlock + 1n,
      lastBlockHash: cursorBlock.hash,
    },
    update: {
      nextBlock: toBlock + 1n,
      lastBlockHash: cursorBlock.hash,
    },
  });
}

export async function ingestGalaxyPulseRounds(options: GalaxyPulseIngestOptions): Promise<void> {
  const jackpotAddress = getAddress(options.jackpotAddress ?? GALAXY_PULSE_JACKPOT_ADDRESS);
  const makeClient = options.makeClient ?? defaultGalaxyPulseClient;
  await readWithRpcFallback(options.rpcEndpoints, async (rpcUrl) =>
    ingestGalaxyPulseOnClient({
      ...options,
      client: makeClient(rpcUrl),
      jackpotAddress,
    }),
  );
}

/** Explicit worker entry point for the mutating daily leaderboard finalization. */
export async function runLeaderboardFinalization(
  env: Record<string, string | undefined> = process.env,
  dependencies: LeaderboardWorkerDependencies = {},
): Promise<void> {
  const config = loadBackendPlanetConfig(env);
  const prisma = dependencies.prisma ?? getPrismaClient(config.databaseUrl);
  const now = dependencies.now ?? new Date();
  if (config.galaxyPulseStartBlock != null) {
    await ingestGalaxyPulseRounds({
      prisma,
      startBlock: config.galaxyPulseStartBlock,
      confirmations: config.confirmations,
      rpcEndpoints: [config.rpcUrl, ...(config.rpcFallbackUrls ?? [])],
      makeClient: dependencies.makeClient,
    });
    await (dependencies.assertFresh ?? assertGalaxyPulseFresh)({
      prisma,
      galaxyPulseStartBlock: config.galaxyPulseStartBlock,
      now,
    });
  }
  await (dependencies.finalize ?? ensureOverdueLeaderboardPeriodsFinalized)(prisma, now, {
    mineralEconomyCutoverAt: config.mineralEconomyCutoverAt,
  });
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  runLeaderboardFinalization().catch(() => {
    process.stderr.write('Leaderboard finalization failed.\n');
    process.exitCode = 1;
  });
}
