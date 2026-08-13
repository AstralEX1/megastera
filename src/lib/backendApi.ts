import { type Address, getAddress, type Hex, isAddress, isHash } from 'viem';

/** One base URL for backend Planet, mining, and leaderboard services. */
const configuredBase = (
  import.meta.env.VITE_BACKEND_API_BASE_URL
)?.trim();

export const BACKEND_API_BASE_URL = configuredBase ?? '';

export function backendApiUrl(path: string, base = BACKEND_API_BASE_URL): string {
  if (!path.startsWith('/')) throw new Error('Backend API paths must start with /.');
  if (!base) return path;
  return new URL(path, base.endsWith('/') ? base : `${base}/`).toString();
}

export function backendApiFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = backendApiUrl(path);
  return init === undefined ? fetch(url) : fetch(url, init);
}

export type BackendPlanet = {
  planetId: string;
  chainId: number;
  ticketId: string;
  ownerAddress: Address;
  name: string;
  seed: Hex;
  traitsHash: Hex;
  generatorVersion: number;
  planetType: string;
  terrain: string;
  rarity: string;
  satelliteCount: number;
  hasRing: boolean;
  baseMineralsPerDay: string;
  generatedAt: string;
  status: 'READY' | 'FAILED';
  gifHash: Hex | null;
  gifUrl: string;
  ticket: {
    ticketId: string;
    drawingId: string;
    normals: number[];
    bonusBall: number;
    originTxHash: Hex;
    logIndex: string;
    purchasedAt?: string;
  };
};

function parseBackendPlanet(value: unknown): BackendPlanet {
  if (!value || typeof value !== 'object') throw new Error('Backend Planet response is malformed.');
  const candidate = value as Partial<BackendPlanet>;
  const ownerAddress = candidate.ownerAddress;
  if (
    typeof candidate.planetId !== 'string' ||
    typeof candidate.ticketId !== 'string' ||
    !isAddress(ownerAddress ?? '') ||
    typeof candidate.name !== 'string' ||
    !isHash(candidate.seed ?? '') ||
    !isHash(candidate.traitsHash ?? '') ||
    typeof candidate.gifUrl !== 'string' ||
    !candidate.ticket ||
    typeof candidate.ticket !== 'object'
  ) {
    throw new Error('Backend Planet response is malformed.');
  }
  const ticket = candidate.ticket;
  if (!isHash(ticket.originTxHash ?? '')) throw new Error('Backend Planet response is malformed.');
  return {
    ...candidate,
    ownerAddress: getAddress(ownerAddress as Address),
  } as BackendPlanet;
}

export async function fetchBackendPlanets(
  owner: Address,
  options: { signal?: AbortSignal } = {},
): Promise<BackendPlanet[]> {
  const response = await backendApiFetch(`/api/planets?owner=${encodeURIComponent(getAddress(owner))}`, {
    signal: options.signal,
  });
  const payload = await response.json().catch(() => undefined);
  if (!response.ok) throw new Error(`Backend Planet lookup returned HTTP ${response.status}.`);
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { planets?: unknown }).planets)) {
    throw new Error('Backend Planet response is malformed.');
  }
  return (payload as { planets: unknown[] }).planets.map(parseBackendPlanet);
}

export async function requestBackendPlanetGeneration(args: {
  transactionHash: Hex;
  logIndex: bigint;
  recipient?: Address;
}): Promise<BackendPlanet> {
  const response = await backendApiFetch('/api/planets/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      transactionHash: args.transactionHash,
      logIndex: Number(args.logIndex),
      recipient: args.recipient ? getAddress(args.recipient) : undefined,
    }),
  });
  const payload = await response.json().catch(() => undefined);
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && typeof (payload as { error?: unknown }).error === 'string'
      ? (payload as { error: string }).error
      : `Backend Planet generation returned HTTP ${response.status}.`;
    throw new Error(message);
  }
  if (!payload || typeof payload !== 'object' || !('planet' in payload)) {
    throw new Error('Backend Planet generation response is malformed.');
  }
  return parseBackendPlanet((payload as { planet: unknown }).planet);
}

export function backendPlanetGifUrl(planetId: string): string {
  return backendApiUrl(`/api/planets/${encodeURIComponent(planetId)}/gif`);
}
