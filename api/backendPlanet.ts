import { getAddress, keccak256, type Address, type Hex } from 'viem';
import {
  createPlanetConfig,
  derivePlanet,
  derivePlanetPreview,
  GENERATOR_VERSION,
  renderPlanetGif,
} from '@megaplanets/planet-generator';
import type { PrismaClient } from './generated/prisma/client';
import { normalizeMegasteraProof, type MegasteraProof } from './eligibility';
import { BASE_SEPOLIA_CHAIN_ID as CONFIGURED_CHAIN_ID } from './config';

export type BackendPlanetStatus = 'READY' | 'FAILED';

export type BackendPlanetTicket = {
  ticketId: string;
  drawingId: string;
  normals: number[];
  bonusBall: number;
  originTxHash: Hex;
  logIndex: string;
  purchasedAt?: string;
};

export type BackendPlanetRecord = {
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
  status: BackendPlanetStatus;
  gifHash: Hex | null;
  gifUrl?: string;
  ticket: BackendPlanetTicket;
};

type BackendPlanetDraft = Omit<BackendPlanetRecord, 'planetId' | 'gifUrl' | 'ticket' | 'gifHash'> & {
  gifHash: Hex;
  gifData: Uint8Array;
  ticket: BackendPlanetTicket;
};

export type BackendPlanetGif = {
  bytes: Uint8Array;
  hash: Hex;
};

export type BackendPlanetStore = {
  generatePlanet(proof: MegasteraProof): Promise<BackendPlanetRecord>;
  listPlanets(ownerAddress: Address): Promise<BackendPlanetRecord[]>;
  getPlanet(planetId: string): Promise<BackendPlanetRecord | undefined>;
  getGif(planetId: string): Promise<BackendPlanetGif | undefined>;
};

function proofKey(proof: MegasteraProof): string {
  return `${(proof.originTxHash as string).toLowerCase()}:${proof.logIndex.toString()}`;
}

function ticketFromProof(proof: MegasteraProof): BackendPlanetTicket {
  return {
    ticketId: proof.ticketId.toString(),
    drawingId: proof.drawingId.toString(),
    normals: [...proof.normals],
    bonusBall: proof.bonusBall,
    originTxHash: proof.originTxHash,
    logIndex: proof.logIndex.toString(),
    purchasedAt: proof.purchasedAt?.toISOString(),
  };
}

function assertNow(now: Date): void {
  if (!Number.isFinite(now.getTime())) throw new Error('Backend Planet generation time is invalid.');
}

/** Derives deterministic traits and GIF bytes without accessing browser globals. */
export function deriveBackendPlanet(
  value: MegasteraProof,
  now = new Date(),
): BackendPlanetDraft {
  const proof = normalizeMegasteraProof(value);
  assertNow(now);
  const input = {
    ticketId: proof.ticketId,
    drawingId: proof.drawingId,
    normals: proof.normals,
    bonusBall: proof.bonusBall,
    originTxHash: proof.originTxHash,
  } as const;
  const config = createPlanetConfig();
  const descriptor = derivePlanet(input, config);
  const preview = derivePlanetPreview(input, config);
  const gifData = renderPlanetGif(preview.visual);
  const gifHash = keccak256(gifData);
  return {
    chainId: proof.chainId ?? CONFIGURED_CHAIN_ID,
    ticketId: proof.ticketId.toString(),
    ownerAddress: getAddress(proof.recipient),
    name: descriptor.traits.name,
    seed: descriptor.seed,
    traitsHash: descriptor.traitsHash,
    generatorVersion: GENERATOR_VERSION,
    planetType: descriptor.traits.type,
    terrain: descriptor.traits.terrain,
    rarity: descriptor.traits.rarity,
    satelliteCount: descriptor.traits.satelliteCount,
    hasRing: descriptor.traits.hasRing,
    baseMineralsPerDay: descriptor.traits.minerals.toString(),
    generatedAt: now.toISOString(),
    status: 'READY',
    gifHash,
    gifData,
    ticket: ticketFromProof(proof),
  };
}

function serializeRecord(
  row: {
    id: string;
    chainId: number;
    ticketId: { toFixed: (digits?: number) => string };
    ownerAddress: string;
    planetName: string;
    seed: string;
    traitsHash: string;
    generatorVersion: number;
    planetType: string;
    terrain: string;
    rarity: string;
    satelliteCount: number;
    hasRing: boolean;
    baseMineralsPerDay: bigint;
    generatedAt: Date;
    status: BackendPlanetStatus;
    gifHash: string | null;
    ticketPurchase?: {
      ticketId: { toFixed: (digits?: number) => string };
      drawingId: { toFixed: (digits?: number) => string };
      normals: number[];
      bonusBall: number;
      originTxHash: string;
      logIndex: number;
      purchasedAt: Date;
    } | null;
  },
): BackendPlanetRecord {
  if (!row.ticketPurchase) throw new Error('Backend Planet ticket provenance is missing.');
  return {
    planetId: row.id,
    chainId: row.chainId,
    ticketId: row.ticketId.toFixed(0),
    ownerAddress: getAddress(row.ownerAddress),
    name: row.planetName,
    seed: row.seed as Hex,
    traitsHash: row.traitsHash as Hex,
    generatorVersion: row.generatorVersion,
    planetType: row.planetType,
    terrain: row.terrain,
    rarity: row.rarity,
    satelliteCount: row.satelliteCount,
    hasRing: row.hasRing,
    baseMineralsPerDay: row.baseMineralsPerDay.toString(),
    generatedAt: row.generatedAt.toISOString(),
    status: row.status,
    gifHash: row.gifHash as Hex | null,
    ticket: {
      ticketId: row.ticketPurchase.ticketId.toFixed(0),
      drawingId: row.ticketPurchase.drawingId.toFixed(0),
      normals: row.ticketPurchase.normals,
      bonusBall: row.ticketPurchase.bonusBall,
      originTxHash: row.ticketPurchase.originTxHash as Hex,
      logIndex: row.ticketPurchase.logIndex.toString(),
      purchasedAt: row.ticketPurchase.purchasedAt.toISOString(),
    },
  };
}

type PrismaBackendPlanetRow = Parameters<typeof serializeRecord>[0];

export class PrismaBackendPlanetStore implements BackendPlanetStore {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async generatePlanet(proof: MegasteraProof): Promise<BackendPlanetRecord> {
    const normalized = normalizeMegasteraProof(proof);
    const chainId = normalized.chainId ?? CONFIGURED_CHAIN_ID;
    const logIndex = Number(normalized.logIndex);
    if (!Number.isSafeInteger(logIndex) || logIndex < 0) throw new Error('Proof log index is invalid.');
    const ticket = await this.prisma.ticketPurchase.findUnique({
      where: {
        chainId_originTxHash_logIndex: {
          chainId,
          originTxHash: normalized.originTxHash.toLowerCase(),
          logIndex,
        },
      },
    });
    if (!ticket) throw new Error('Backend Planet proof is not persisted.');
    const existing = await this.prisma.backendPlanet.findUnique({
      where: { ticketPurchaseId: ticket.id },
      include: { ticketPurchase: true },
    });
    if (existing?.status === 'READY' && existing.gifData) return serializeRecord(existing as PrismaBackendPlanetRow);
    const draft = deriveBackendPlanet(normalized, this.now());
    const row = await this.prisma.backendPlanet.upsert({
      where: { ticketPurchaseId: ticket.id },
      create: {
        ticketPurchaseId: ticket.id,
        chainId,
        ticketId: draft.ticketId,
        ownerAddress: draft.ownerAddress.toLowerCase(),
        seed: draft.seed.toLowerCase(),
        traitsHash: draft.traitsHash.toLowerCase(),
        generatorVersion: draft.generatorVersion,
        planetName: draft.name,
        planetType: draft.planetType,
        terrain: draft.terrain,
        rarity: draft.rarity,
        satelliteCount: draft.satelliteCount,
        hasRing: draft.hasRing,
        baseMineralsPerDay: BigInt(draft.baseMineralsPerDay),
        generatedAt: new Date(draft.generatedAt),
        status: 'READY',
        gifData: Buffer.from(draft.gifData),
        gifHash: draft.gifHash.toLowerCase(),
        generationError: null,
      },
      update: {
        chainId,
        ticketId: draft.ticketId,
        ownerAddress: draft.ownerAddress.toLowerCase(),
        seed: draft.seed.toLowerCase(),
        traitsHash: draft.traitsHash.toLowerCase(),
        generatorVersion: draft.generatorVersion,
        planetName: draft.name,
        planetType: draft.planetType,
        terrain: draft.terrain,
        rarity: draft.rarity,
        satelliteCount: draft.satelliteCount,
        hasRing: draft.hasRing,
        baseMineralsPerDay: BigInt(draft.baseMineralsPerDay),
        generatedAt: new Date(draft.generatedAt),
        status: 'READY',
        gifData: Buffer.from(draft.gifData),
        gifHash: draft.gifHash.toLowerCase(),
        generationError: null,
      },
      include: { ticketPurchase: true },
    });
    return serializeRecord(row as PrismaBackendPlanetRow);
  }

  async listPlanets(ownerAddress: Address): Promise<BackendPlanetRecord[]> {
    const rows = await this.prisma.backendPlanet.findMany({
      where: { ownerAddress: getAddress(ownerAddress).toLowerCase(), status: 'READY', gifData: { not: null } },
      orderBy: [{ generatedAt: 'desc' }, { ticketId: 'asc' }],
      include: { ticketPurchase: true },
    });
    return rows.map((row) => serializeRecord(row as PrismaBackendPlanetRow));
  }

  async getPlanet(planetId: string): Promise<BackendPlanetRecord | undefined> {
    const row = await this.prisma.backendPlanet.findFirst({
      where: { id: planetId, status: 'READY', gifData: { not: null } },
      include: { ticketPurchase: true },
    });
    return row ? serializeRecord(row as PrismaBackendPlanetRow) : undefined;
  }

  async getGif(planetId: string): Promise<BackendPlanetGif | undefined> {
    const row = await this.prisma.backendPlanet.findFirst({
      where: { id: planetId, status: 'READY' },
      select: { gifData: true, gifHash: true },
    });
    if (!row?.gifData || !row.gifHash) return undefined;
    return { bytes: new Uint8Array(row.gifData), hash: row.gifHash as Hex };
  }
}

type MemoryRow = BackendPlanetRecord & { gifData: Uint8Array };

export class MemoryBackendPlanetStore implements BackendPlanetStore {
  private readonly rows = new Map<string, MemoryRow>();
  private readonly proofRows = new Map<string, MegasteraProof>();

  public saveProof(proof: MegasteraProof): void {
    const normalized = normalizeMegasteraProof(proof);
    this.proofRows.set(proofKey(normalized), normalized);
  }

  async generatePlanet(proof: MegasteraProof): Promise<BackendPlanetRecord> {
    const normalized = normalizeMegasteraProof(proof);
    const key = proofKey(normalized);
    const existing = this.rows.get(key);
    if (existing?.status === 'READY') return withoutGifData(existing);
    const draft = deriveBackendPlanet(normalized);
    const planetId = existing?.planetId ?? `backend-${key}`;
    const row: MemoryRow = {
      planetId,
      chainId: draft.chainId,
      ticketId: draft.ticketId,
      ownerAddress: draft.ownerAddress,
      name: draft.name,
      seed: draft.seed,
      traitsHash: draft.traitsHash,
      generatorVersion: draft.generatorVersion,
      planetType: draft.planetType,
      terrain: draft.terrain,
      rarity: draft.rarity,
      satelliteCount: draft.satelliteCount,
      hasRing: draft.hasRing,
      baseMineralsPerDay: draft.baseMineralsPerDay,
      generatedAt: draft.generatedAt,
      status: draft.status,
      gifHash: draft.gifHash,
      ticket: draft.ticket,
      gifData: draft.gifData,
    };
    this.rows.set(key, row);
    return withoutGifData(row);
  }

  async listPlanets(ownerAddress: Address): Promise<BackendPlanetRecord[]> {
    return [...this.rows.values()]
      .filter((row) => row.status === 'READY' && row.ownerAddress.toLowerCase() === getAddress(ownerAddress).toLowerCase())
      .sort((left, right) => right.generatedAt.localeCompare(left.generatedAt))
      .map(withoutGifData);
  }

  async getPlanet(planetId: string): Promise<BackendPlanetRecord | undefined> {
    const row = [...this.rows.values()].find((candidate) => candidate.planetId === planetId && candidate.status === 'READY');
    return row ? withoutGifData(row) : undefined;
  }

  async getGif(planetId: string): Promise<BackendPlanetGif | undefined> {
    const row = [...this.rows.values()].find((candidate) => candidate.planetId === planetId && candidate.status === 'READY');
    return row ? { bytes: row.gifData.slice(), hash: row.gifHash as Hex } : undefined;
  }
}

function withoutGifData(row: MemoryRow | BackendPlanetRecord): BackendPlanetRecord {
  const { gifData: _gifData, ...record } = row as MemoryRow;
  return record;
}

export function backendPlanetProofKey(proof: MegasteraProof): string {
  return proofKey(normalizeMegasteraProof(proof));
}
