import { type Address, getAddress, type Hex, isAddress, isHash } from 'viem';
import type { PurchasedTicket } from './purchaseReceipt';

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

export type BackendPlanetCollectionRow = {
  generationStatus: 'pending' | 'generated';
  ticket: BackendPlanet['ticket'];
  planet: BackendPlanet | null;
  generationError?: string | null;
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
  const ticket = parseBackendPlanetTicket(candidate.ticket);
  return {
    ...candidate,
    ownerAddress: getAddress(ownerAddress as Address),
    ticket,
  } as BackendPlanet;
}

function parseBackendPlanetTicket(value: unknown): BackendPlanet['ticket'] {
  if (!value || typeof value !== 'object') throw new Error('Backend Planet response is malformed.');
  const candidate = value as Partial<BackendPlanet['ticket']>;
  if (
    typeof candidate.ticketId !== 'string' ||
    typeof candidate.drawingId !== 'string' ||
    !Array.isArray(candidate.normals) ||
    candidate.normals.length !== 5 ||
    candidate.normals.some((normal) => !Number.isInteger(normal)) ||
    typeof candidate.bonusBall !== 'number' ||
    !Number.isInteger(candidate.bonusBall) ||
    !isHash(candidate.originTxHash ?? '') ||
    typeof candidate.logIndex !== 'string' ||
    !/^\d+$/.test(candidate.logIndex)
  ) {
    throw new Error('Backend Planet response is malformed.');
  }
  return {
    ticketId: candidate.ticketId,
    drawingId: candidate.drawingId,
    normals: [...candidate.normals],
    bonusBall: candidate.bonusBall,
    originTxHash: candidate.originTxHash as Hex,
    logIndex: candidate.logIndex,
    purchasedAt: typeof candidate.purchasedAt === 'string' ? candidate.purchasedAt : undefined,
  };
}

function parseBackendPlanetCollectionRow(value: unknown): BackendPlanetCollectionRow {
  if (!value || typeof value !== 'object') throw new Error('Backend Planet collection response is malformed.');
  const candidate = value as Partial<BackendPlanetCollectionRow>;
  if (
    (candidate.generationStatus !== 'pending' && candidate.generationStatus !== 'generated') ||
    !candidate.ticket ||
    typeof candidate.ticket !== 'object' ||
    (candidate.planet !== null && candidate.planet !== undefined && typeof candidate.planet !== 'object')
  ) {
    throw new Error('Backend Planet collection response is malformed.');
  }
  if (candidate.generationStatus === 'generated' && !candidate.planet) {
    throw new Error('Backend Planet collection response is malformed.');
  }
  const planet = candidate.planet ? parseBackendPlanet(candidate.planet) : null;
  return {
    generationStatus: candidate.generationStatus,
    ticket: parseBackendPlanetTicket(candidate.ticket),
    planet,
    generationError: typeof candidate.generationError === 'string' ? candidate.generationError : null,
  };
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

export async function fetchBackendPlanetCollection(
  owner: Address,
  options: { signal?: AbortSignal } = {},
): Promise<BackendPlanetCollectionRow[]> {
  const response = await backendApiFetch(`/api/planets/collection?owner=${encodeURIComponent(getAddress(owner))}`, {
    signal: options.signal,
  });
  const payload = await response.json().catch(() => undefined);
  if (!response.ok) throw new Error(`Backend Planet collection returned HTTP ${response.status}.`);
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { planets?: unknown }).planets)) {
    throw new Error('Backend Planet collection response is malformed.');
  }
  return (payload as { planets: unknown[] }).planets.map(parseBackendPlanetCollectionRow);
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

export async function requestBackendPlanetGenerationBatch(args: {
  recipient: Address;
  tickets: readonly PurchasedTicket[];
}): Promise<BackendPlanet[]> {
  if (args.tickets.length === 0) return [];
  const response = await backendApiFetch('/api/planets/generate/batch', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      references: args.tickets.map((ticket) => ({
        transactionHash: ticket.originTxHash,
        logIndex: Number(ticket.logIndex),
        recipient: getAddress(args.recipient),
      })),
    }),
  });
  const payload = await response.json().catch(() => undefined);
  if (!response.ok) throw new Error(`Backend Planet batch generation returned HTTP ${response.status}.`);
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { planets?: unknown }).planets)) {
    throw new Error('Backend Planet batch response is malformed.');
  }
  return (payload as { planets: unknown[] }).planets.map(parseBackendPlanet);
}

export function backendPlanetGifUrl(planetId: string): string {
  return backendApiUrl(`/api/planets/${encodeURIComponent(planetId)}/gif`);
}
