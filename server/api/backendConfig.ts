import { BASE_CHAIN_ID, DEFAULT_RECEIPT_CONFIRMATIONS } from './config.js';

export type BackendPlanetConfig = {
  chainId: typeof BASE_CHAIN_ID;
  rpcUrl: string;
  rpcFallbackUrls?: readonly string[];
  databaseUrl: string;
  confirmations: bigint;
};

function required(env: Record<string, string | undefined>, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing required server environment variable ${name}.`);
  return value;
}

export function loadBackendPlanetConfig(
  env: Record<string, string | undefined> = process.env,
): BackendPlanetConfig {
  const rpcUrl = required(env, 'BASE_RPC_URL');
  const databaseUrl = required(env, 'DATABASE_URL');
  const confirmationsRaw = env.MEGAPLANETS_CONFIRMATIONS?.trim();
  let confirmations = DEFAULT_RECEIPT_CONFIRMATIONS;
  if (confirmationsRaw) {
    try {
      confirmations = BigInt(confirmationsRaw);
    } catch {
      throw new Error('MEGAPLANETS_CONFIRMATIONS must be a non-negative integer.');
    }
  }
  if (confirmations < 0n) throw new Error('MEGAPLANETS_CONFIRMATIONS must be a non-negative integer.');
  const rpcFallbackUrls = (env.BASE_RPC_FALLBACK_URLS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value, index, values) => value !== rpcUrl && values.indexOf(value) === index)
    .slice(0, 3);
  return { chainId: BASE_CHAIN_ID, rpcUrl, rpcFallbackUrls, databaseUrl, confirmations };
}
