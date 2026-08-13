import { type Address, createPublicClient, getAddress, type Hex, http, isAddress, isHash } from 'viem';
import { baseSepolia } from 'viem/chains';
import { BASE_SEPOLIA_CHAIN_ID, DEFAULT_RECEIPT_CONFIRMATIONS } from './config';
import type { BackendPlanetConfig } from './backendConfig';
import { type MegasteraProof, MegasteraVerifier } from './eligibility';
import { readWithRpcFallback } from './rpc';

export type ReceiptReference = { transactionHash: Hex; logIndex: number; recipient?: Address };

type ReceiptRpcClient = {
  getChainId(): Promise<number>;
  getTransactionReceipt(args: { hash: Hex }): Promise<import('viem').TransactionReceipt>;
  getBlockNumber(): Promise<bigint>;
  getBlock(args: { blockNumber: bigint } | { blockHash: Hex }): Promise<{
    hash: Hex | null;
    timestamp: bigint;
  }>;
};

type RpcClientFactory = (rpcUrl: string) => ReceiptRpcClient;

function rpcEndpoints(config: Pick<BackendPlanetConfig, 'rpcUrl' | 'rpcFallbackUrls'>): readonly string[] {
  return [...new Set([config.rpcUrl, ...(config.rpcFallbackUrls ?? [])])].slice(0, 3);
}

export type ReceiptFinalityInput = { blockNumber: bigint; blockHash: string };
export type ReceiptFinalityState = { latestBlock: bigint; canonicalBlockHash: string; confirmations?: bigint };

/** Fails closed when a receipt is not deep enough or its block was reorged. */
export function assertReceiptFinality(receipt: ReceiptFinalityInput, state: ReceiptFinalityState): void {
  const confirmations = state.confirmations ?? DEFAULT_RECEIPT_CONFIRMATIONS;
  if (confirmations < 0n) throw new Error('Receipt confirmation depth must be non-negative.');
  if (state.latestBlock < receipt.blockNumber + confirmations) {
    throw new Error(`Receipt requires ${confirmations.toString()} confirmations.`);
  }
  if (state.canonicalBlockHash.toLowerCase() !== receipt.blockHash.toLowerCase()) {
    throw new Error('Receipt block hash is no longer canonical.');
  }
}

/** Verifies one canonical Megapot receipt; this is the only Planet creation authority. */
export async function findTicketFromReceipt(
  config: Pick<BackendPlanetConfig, 'rpcUrl' | 'rpcFallbackUrls' | 'confirmations'>,
  request: ReceiptReference,
  makeClient: RpcClientFactory = (rpcUrl) =>
    createPublicClient({ chain: baseSepolia, transport: http(rpcUrl) }) as unknown as ReceiptRpcClient,
): Promise<MegasteraProof> {
  return readWithRpcFallback(rpcEndpoints(config), async (rpcUrl) => {
    const client = makeClient(rpcUrl);
    const chainId = await client.getChainId();
    if (chainId !== BASE_SEPOLIA_CHAIN_ID) throw new Error('Receipt RPC is not Base Sepolia.');
    const receipt = await client.getTransactionReceipt({ hash: request.transactionHash });
    const ticket = new MegasteraVerifier({ chainId }).verifyReceipt(receipt, {
      transactionHash: request.transactionHash,
      logIndex: request.logIndex,
      recipient: request.recipient,
    });
    const [latestBlock, canonicalBlock, receiptBlock] = await Promise.all([
      client.getBlockNumber(),
      client.getBlock({ blockNumber: receipt.blockNumber }),
      client.getBlock({ blockHash: receipt.blockHash }),
    ]);
    if (!canonicalBlock.hash || !receiptBlock.hash) throw new Error('Receipt block hash lookup is incomplete.');
    assertReceiptFinality(
      { blockNumber: receipt.blockNumber, blockHash: receipt.blockHash },
      { latestBlock, canonicalBlockHash: canonicalBlock.hash, confirmations: config.confirmations },
    );
    if (receiptBlock.hash.toLowerCase() !== receipt.blockHash.toLowerCase()) {
      throw new Error('Receipt block hash lookup does not match the receipt.');
    }
    const timestamp = Number(receiptBlock.timestamp);
    if (!Number.isSafeInteger(timestamp) || timestamp < 0) throw new Error('Receipt block timestamp is invalid.');
    return { ...ticket, blockHash: receipt.blockHash, purchasedAt: new Date(timestamp * 1_000) };
  });
}

export function parseReceiptReference(value: unknown): ReceiptReference | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.transactionHash !== 'string' ||
    !isHash(candidate.transactionHash) ||
    typeof candidate.logIndex !== 'number' ||
    !Number.isSafeInteger(candidate.logIndex) ||
    candidate.logIndex < 0
  ) return undefined;
  if (candidate.recipient !== undefined && (typeof candidate.recipient !== 'string' || !isAddress(candidate.recipient))) return undefined;
  return {
    transactionHash: candidate.transactionHash,
    logIndex: candidate.logIndex,
    recipient: candidate.recipient === undefined ? undefined : getAddress(candidate.recipient),
  };
}
