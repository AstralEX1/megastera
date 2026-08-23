import { useQuery } from '@tanstack/react-query';
import { BACKEND_API_BASE_URL, backendApiFetch } from '@/lib/backendApi';

export type PlanetUpgradeSnapshot = {
  targetLevel: number;
  bonusBpsAfter: number;
  costMicros: string;
};

export type PlanetMiningSnapshot = {
  planetId: string;
  planetType: string;
  sameTypeCount: number;
  collectionBonusBps: number;
  baseMineralsPerDay: string;
  effectiveMineralsPerDayMicros: string;
  upgradeLevel: number;
  upgradeBonusBps: number;
  galaxyPulseBps: number;
  nextUpgrade: PlanetUpgradeSnapshot | null;
};

export type GalaxyPulseSnapshot = {
  drawingId: string;
  settledAt: string;
  slots: Array<{ planetType: string; modifierBps: number }>;
};

export type WalletMiningSnapshot = {
  ownerAddress: `0x${string}`;
  asOf: string;
  ownedPlanetCount: number;
  currentBalanceMicros: string;
  effectiveMineralsPerDayMicros: string;
  upgradesEnabled: boolean;
  galaxyPulse: GalaxyPulseSnapshot | null;
  planets: PlanetMiningSnapshot[];
};

export const MINING_REFRESH_INTERVAL_MS = 60_000;

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null;
}

function requiredObject(value: unknown, label: string): JsonObject {
  if (!isObject(value)) throw new Error(`Wallet mining ${label} is malformed.`);
  return value;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`Wallet mining ${label} is malformed.`);
  return value;
}

function requiredMicros(value: unknown, label: string): string {
  const stringValue = requiredString(value, label);
  if (!/^\d+$/.test(stringValue)) throw new Error(`Wallet mining ${label} is malformed.`);
  return stringValue;
}

function requiredInteger(value: unknown, label: string, minimum: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < minimum) {
    throw new Error(`Wallet mining ${label} is malformed.`);
  }
  return value;
}

function requiredSignedInteger(value: unknown, label: string, minimum: number, maximum: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`Wallet mining ${label} is malformed.`);
  }
  return value;
}

function isWalletAddress(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && /^0x[\da-fA-F]{40}$/.test(value);
}

function requiredAddress(value: unknown): `0x${string}` {
  if (!isWalletAddress(value)) {
    throw new Error('Wallet mining ownerAddress is malformed.');
  }
  return value;
}

function requiredTimestamp(value: unknown, label: string): string {
  const timestamp = requiredString(value, label);
  if (!Number.isFinite(new Date(timestamp).getTime())) throw new Error(`Wallet mining ${label} is malformed.`);
  return timestamp;
}

function parseNextUpgrade(value: unknown): PlanetUpgradeSnapshot | null {
  if (value === null) return null;
  const nextUpgrade = requiredObject(value, 'nextUpgrade');
  const targetLevel = requiredInteger(nextUpgrade.targetLevel, 'nextUpgrade.targetLevel', 1);
  if (targetLevel > 3) throw new Error('Wallet mining nextUpgrade.targetLevel is malformed.');
  return {
    targetLevel,
    bonusBpsAfter: requiredInteger(nextUpgrade.bonusBpsAfter, 'nextUpgrade.bonusBpsAfter', 0),
    costMicros: requiredMicros(nextUpgrade.costMicros, 'nextUpgrade.costMicros'),
  };
}

function parseGalaxyPulse(value: unknown): GalaxyPulseSnapshot | null {
  if (value === null || value === undefined) return null;
  const pulse = requiredObject(value, 'galaxyPulse');
  if (!Array.isArray(pulse.slots) || pulse.slots.length !== 4) {
    throw new Error('Wallet mining galaxyPulse.slots is malformed.');
  }
  return {
    drawingId: requiredMicros(pulse.drawingId, 'galaxyPulse.drawingId'),
    settledAt: requiredTimestamp(pulse.settledAt, 'galaxyPulse.settledAt'),
    slots: pulse.slots.map((value) => {
      const slot = requiredObject(value, 'galaxyPulse slot');
      return {
        planetType: requiredString(slot.planetType, 'galaxyPulse slot planetType'),
        modifierBps: requiredSignedInteger(
          slot.modifierBps,
          'galaxyPulse slot modifierBps',
          -5_000,
          5_000,
        ),
      };
    }),
  };
}

function parsePlanet(value: unknown, upgradesEnabled: boolean): PlanetMiningSnapshot {
  const planet = requiredObject(value, 'Planet');
  const upgradeLevel = planet.upgradeLevel === undefined && !upgradesEnabled
    ? 0
    : requiredInteger(planet.upgradeLevel, 'Planet upgradeLevel', 0);
  if (upgradeLevel > 3) throw new Error('Wallet mining Planet upgradeLevel is malformed.');
  const upgradeBonusBps = planet.upgradeBonusBps === undefined && !upgradesEnabled
    ? 0
    : requiredInteger(planet.upgradeBonusBps, 'Planet upgradeBonusBps', 0);
  const nextUpgrade = planet.nextUpgrade === undefined && !upgradesEnabled
    ? null
    : parseNextUpgrade(planet.nextUpgrade);

  return {
    planetId: requiredString(planet.planetId, 'Planet planetId'),
    planetType: requiredString(planet.planetType, 'Planet planetType'),
    sameTypeCount: requiredInteger(planet.sameTypeCount, 'Planet sameTypeCount', 1),
    collectionBonusBps: requiredInteger(planet.collectionBonusBps, 'Planet collectionBonusBps', 0),
    baseMineralsPerDay: requiredMicros(planet.baseMineralsPerDay, 'Planet baseMineralsPerDay'),
    effectiveMineralsPerDayMicros: requiredMicros(planet.effectiveMineralsPerDayMicros, 'Planet effectiveMineralsPerDayMicros'),
    upgradeLevel,
    upgradeBonusBps,
    galaxyPulseBps: planet.galaxyPulseBps === undefined
      ? 0
      : requiredSignedInteger(planet.galaxyPulseBps, 'Planet galaxyPulseBps', -20_000, 20_000),
    nextUpgrade,
  };
}

export function parseWalletMiningSnapshot(value: unknown): WalletMiningSnapshot {
  const mining = requiredObject(value, 'snapshot');
  const upgradesEnabled = mining.upgradesEnabled;
  if (typeof upgradesEnabled !== 'boolean') throw new Error('Wallet mining upgradesEnabled is malformed.');
  if (!Array.isArray(mining.planets)) throw new Error('Wallet mining planets is malformed.');

  return {
    ownerAddress: requiredAddress(mining.ownerAddress),
    asOf: requiredTimestamp(mining.asOf, 'asOf'),
    ownedPlanetCount: requiredInteger(mining.ownedPlanetCount, 'ownedPlanetCount', 0),
    currentBalanceMicros: requiredMicros(mining.currentBalanceMicros, 'currentBalanceMicros'),
    effectiveMineralsPerDayMicros: requiredMicros(mining.effectiveMineralsPerDayMicros, 'effectiveMineralsPerDayMicros'),
    upgradesEnabled,
    galaxyPulse: parseGalaxyPulse(mining.galaxyPulse),
    planets: mining.planets.map((planet) => parsePlanet(planet, upgradesEnabled)),
  };
}

export async function fetchWalletMining(address: `0x${string}`): Promise<WalletMiningSnapshot> {
  const response = await backendApiFetch(`/api/wallets/${address}/mining`);
  const payload = await response.json().catch(() => undefined);
  if (!response.ok) throw new Error(`Wallet mining returned HTTP ${response.status}.`);
  if (!isObject(payload) || !('mining' in payload)) throw new Error('Wallet mining response is malformed.');
  return parseWalletMiningSnapshot(payload.mining);
}

export function walletMiningQueryOptions(address: `0x${string}` | undefined) {
  return {
    queryKey: ['megastera-backend', BACKEND_API_BASE_URL, 'wallet-mining', address] as const,
    queryFn: () => {
      if (!address) throw new Error('A connected wallet is required.');
      return fetchWalletMining(address);
    },
    enabled: !!address,
    staleTime: MINING_REFRESH_INTERVAL_MS,
    refetchInterval: MINING_REFRESH_INTERVAL_MS,
  };
}

export function useWalletMining(address: `0x${string}` | undefined) {
  return useQuery(walletMiningQueryOptions(address));
}
