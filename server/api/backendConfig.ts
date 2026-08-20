import { BASE_CHAIN_ID, DEFAULT_RECEIPT_CONFIRMATIONS } from './config.js';

export type BackendPlanetConfig = {
  chainId: typeof BASE_CHAIN_ID;
  rpcUrl: string;
  rpcFallbackUrls?: readonly string[];
  databaseUrl: string;
  confirmations: bigint;
  /** Optional in dependency overrides so pre-v2 Planet APIs remain source-compatible. */
  mineralEconomyCutoverAt?: Date | null;
  mineralUpgradesEnabled?: boolean;
};

export type MineralEconomyConfig = {
  mineralEconomyCutoverAt: Date | null;
  mineralUpgradesEnabled: boolean;
};

function required(env: Record<string, string | undefined>, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing required server environment variable ${name}.`);
  return value;
}

function parseMineralEconomyCutoverAt(env: Record<string, string | undefined>): Date | null {
  const raw = env.MINERAL_ECONOMY_CUTOVER_AT?.trim();
  if (!raw) return null;
  const value = new Date(raw);
  if (!Number.isFinite(value.getTime())) {
    throw new Error('MINERAL_ECONOMY_CUTOVER_AT must be a valid timestamp.');
  }
  return value;
}

function parseMineralUpgradesEnabled(env: Record<string, string | undefined>): boolean {
  const raw = env.MINERAL_UPGRADES_ENABLED?.trim().toLowerCase();
  if (!raw) return false;
  if (raw === 'true' || raw === '1' || raw === 'yes' || raw === 'on') return true;
  if (raw === 'false' || raw === '0' || raw === 'no' || raw === 'off') return false;
  throw new Error('MINERAL_UPGRADES_ENABLED must be a boolean.');
}

export function loadMineralEconomyConfig(
  env: Record<string, string | undefined> = process.env,
): MineralEconomyConfig {
  return {
    mineralEconomyCutoverAt: parseMineralEconomyCutoverAt(env),
    mineralUpgradesEnabled: parseMineralUpgradesEnabled(env),
  };
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
  if (confirmations < 0n)
    throw new Error('MEGAPLANETS_CONFIRMATIONS must be a non-negative integer.');
  const rpcFallbackUrls = (env.BASE_RPC_FALLBACK_URLS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value, index, values) => value !== rpcUrl && values.indexOf(value) === index)
    .slice(0, 3);
  return {
    chainId: BASE_CHAIN_ID,
    rpcUrl,
    rpcFallbackUrls,
    databaseUrl,
    confirmations,
    ...loadMineralEconomyConfig(env),
  };
}
