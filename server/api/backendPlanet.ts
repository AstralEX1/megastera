import { getAddress, keccak256, stringToHex, type Address, type Hex } from 'viem';
import {
  createPlanetConfig,
  derivePlanet,
  derivePlanetPreview,
  GENERATOR_VERSION,
  renderPlanetGif,
} from '@megaplanets/planet-generator';
import type { PrismaClient } from './generated/prisma/client.js';
import { BASE_JACKPOT, normalizeMegasteraProof, type MegasteraProof } from './eligibility.js';
import { BASE_CHAIN_ID as CONFIGURED_CHAIN_ID, MEGASTERA_SOURCE } from './config.js';
import {
  ensureAndLockMineralAccount,
  settleMineralAccount,
  type MineralSettlementPlanet,
  type MineralSettlementPurchase,
} from './mineralAccounts.js';

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

export type BackendPlanetCollectionRecord = {
  generationStatus: 'pending' | 'generated';
  ticket: BackendPlanetTicket;
  planet: BackendPlanetRecord | null;
  generationError?: string | null;
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
  listCollection(ownerAddress: Address): Promise<BackendPlanetCollectionRecord[]>;
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

type PersistedTicketRow = {
  ticketId: { toFixed: (digits?: number) => string };
  drawingId: { toFixed: (digits?: number) => string };
  normals: number[];
  bonusBall: number;
  originTxHash: string;
  logIndex: number;
  purchasedAt: Date;
};

function ticketFromPersistedRow(row: PersistedTicketRow): BackendPlanetTicket {
  return {
    ticketId: row.ticketId.toFixed(0),
    drawingId: row.drawingId.toFixed(0),
    normals: [...row.normals],
    bonusBall: row.bonusBall,
    originTxHash: row.originTxHash as Hex,
    logIndex: row.logIndex.toString(),
    purchasedAt: row.purchasedAt.toISOString(),
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && (error as { code?: unknown }).code === 'P2002');
}

function planetPersistenceData(
  ticketId: string,
  draft: BackendPlanetDraft,
  generatedAt: Date,
) {
  return {
    ticketPurchaseId: ticketId,
    chainId: draft.chainId,
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
    generatedAt,
    status: 'READY' as const,
    gifData: Buffer.from(draft.gifData),
    gifHash: draft.gifHash.toLowerCase(),
    generationError: null,
  };
}

class PreCutoverGeneration extends Error {}

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
    gifData?: Uint8Array | null;
    gifHash: string | null;
    generationError?: string | null;
    ticketPurchase?: PersistedTicketRow | null;
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
    ticket: ticketFromPersistedRow(row.ticketPurchase),
  };
}

type PrismaBackendPlanetRow = Parameters<typeof serializeRecord>[0];
type PrismaCollectionRow = PersistedTicketRow & {
  recipient: string;
  backendPlanet: PrismaBackendPlanetRow | null;
};

function serializeCollectionRow(row: PrismaCollectionRow): BackendPlanetCollectionRecord {
  if (row.backendPlanet?.status === 'READY' && row.backendPlanet.gifData) {
    const planet = serializeRecord({
      ...row.backendPlanet,
      ticketPurchase: row,
    });
    return { generationStatus: 'generated', ticket: planet.ticket, planet };
  }
  return {
    generationStatus: 'pending',
    ticket: ticketFromPersistedRow(row),
    planet: null,
    generationError: row.backendPlanet?.generationError ?? null,
  };
}

export class PrismaBackendPlanetStore implements BackendPlanetStore {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly now: () => Date = () => new Date(),
    private readonly mineralEconomyCutoverAt: Date | null = null,
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
    if (
      ticket.ticketId.toFixed(0) !== normalized.ticketId.toString() ||
      ticket.drawingId.toFixed(0) !== normalized.drawingId.toString() ||
      ticket.recipient !== getAddress(normalized.recipient).toLowerCase() ||
      ticket.bonusBall !== normalized.bonusBall ||
      ticket.normals.length !== normalized.normals.length ||
      ticket.normals.some((normal, index) => normal !== normalized.normals[index])
    ) {
      throw new Error('Backend Planet proof conflicts with persisted ticket provenance.');
    }
    const existing = await this.prisma.backendPlanet.findUnique({
      where: { ticketPurchaseId: ticket.id },
      include: { ticketPurchase: true },
    });
    if (existing?.status === 'READY' && existing.gifData) return serializeRecord(existing as PrismaBackendPlanetRow);
    const draft = deriveBackendPlanet(normalized, this.now());
    if (this.mineralEconomyCutoverAt) {
      return this.generatePostCutoverPlanet(ticket, draft, existing as PrismaBackendPlanetRow | null);
    }
    const candidateAt = new Date(draft.generatedAt);
    const data = planetPersistenceData(ticket.id, draft, candidateAt);
    try {
      const row = existing
        ? await this.prisma.backendPlanet.update({
            where: { id: existing.id },
            data,
            include: { ticketPurchase: true },
          })
        : await this.prisma.backendPlanet.create({
            data,
            include: { ticketPurchase: true },
          });
      return serializeRecord(row as PrismaBackendPlanetRow);
    } catch (error) {
      if (!existing && isUniqueConstraintError(error)) {
        const concurrent = await this.prisma.backendPlanet.findUnique({
          where: { ticketPurchaseId: ticket.id },
          include: { ticketPurchase: true },
        });
        if (concurrent?.status === 'READY' && concurrent.gifData) {
          return serializeRecord(concurrent as PrismaBackendPlanetRow);
        }
      }
      throw error;
    }
  }

  private async generatePostCutoverPlanet(
    ticket: PersistedTicketRow & { id: string },
    draft: BackendPlanetDraft,
    existing: PrismaBackendPlanetRow | null,
  ): Promise<BackendPlanetRecord> {
    const cutoverAt = this.mineralEconomyCutoverAt;
    if (!cutoverAt) throw new Error('Mineral economy cutover is missing.');
    try {
      const row = await this.prisma.$transaction(async (transaction) => {
        const account = await ensureAndLockMineralAccount(transaction, draft.ownerAddress, cutoverAt);
        const current = await transaction.backendPlanet.findUnique({
          where: { ticketPurchaseId: ticket.id },
          include: { ticketPurchase: true },
        });
        if (current?.status === 'READY' && current.gifData) return current as PrismaBackendPlanetRow;
        const effectiveAt = this.now();
        assertNow(effectiveAt);
        if (effectiveAt < cutoverAt) throw new PreCutoverGeneration('Generation is before mineral economy cutover.');
        const planets = (await transaction.backendPlanet.findMany({
          where: { ownerAddress: draft.ownerAddress.toLowerCase(), status: 'READY' },
          select: {
            id: true,
            ownerAddress: true,
            planetType: true,
            baseMineralsPerDay: true,
            generatedAt: true,
            upgradeLevel: true,
            upgradeBonusBps: true,
          },
        })) as MineralSettlementPlanet[];
        const purchases = (await transaction.planetUpgradePurchase.findMany({
          where: { walletAddress: draft.ownerAddress.toLowerCase(), purchasedAt: { lte: effectiveAt } },
          orderBy: [{ purchasedAt: 'asc' }, { id: 'asc' }],
          select: { planetId: true, targetLevel: true, bonusBpsAfter: true, purchasedAt: true },
        })) as MineralSettlementPurchase[];
        await settleMineralAccount({
          prisma: transaction,
          account,
          planets,
          purchases,
          settledAt: effectiveAt,
          anchor: cutoverAt,
        });
        const data = planetPersistenceData(ticket.id, draft, effectiveAt);
        const persisted = current
          ? await transaction.backendPlanet.update({
              where: { id: current.id },
              data,
              include: { ticketPurchase: true },
            })
          : await transaction.backendPlanet.create({
              data,
              include: { ticketPurchase: true },
            });
        return persisted as PrismaBackendPlanetRow;
      });
      return serializeRecord(row);
    } catch (error) {
      if (!(error instanceof PreCutoverGeneration)) throw error;
      const data = planetPersistenceData(ticket.id, draft, new Date(draft.generatedAt));
      const row = existing
        ? await this.prisma.backendPlanet.update({
            where: { id: existing.id },
            data,
            include: { ticketPurchase: true },
          })
        : await this.prisma.backendPlanet.create({
            data,
            include: { ticketPurchase: true },
          });
      return serializeRecord(row as PrismaBackendPlanetRow);
    }
  }

  async listPlanets(ownerAddress: Address): Promise<BackendPlanetRecord[]> {
    const rows = await this.prisma.backendPlanet.findMany({
      where: { ownerAddress: getAddress(ownerAddress).toLowerCase(), status: 'READY', gifData: { not: null } },
      orderBy: [{ generatedAt: 'desc' }, { ticketId: 'asc' }],
      include: { ticketPurchase: true },
    });
    return rows.map((row) => serializeRecord(row as PrismaBackendPlanetRow));
  }

  async listCollection(ownerAddress: Address): Promise<BackendPlanetCollectionRecord[]> {
    const rows = await this.prisma.ticketPurchase.findMany({
      where: {
        chainId: CONFIGURED_CHAIN_ID,
        jackpotAddress: BASE_JACKPOT.toLowerCase(),
        source: stringToHex(MEGASTERA_SOURCE, { size: 32 }),
        recipient: getAddress(ownerAddress).toLowerCase(),
      },
      orderBy: [{ purchasedAt: 'desc' }, { ticketId: 'asc' }],
      include: { backendPlanet: true },
    });
    return rows.map((row) => serializeCollectionRow(row as PrismaCollectionRow));
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
    const planetId = existing?.planetId ?? `backend-${key.replace(':', '-')}`;
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

  async listCollection(ownerAddress: Address): Promise<BackendPlanetCollectionRecord[]> {
    const normalized = getAddress(ownerAddress).toLowerCase();
    const generated = new Map(
      [...this.rows.values()]
        .filter((row) => row.ownerAddress.toLowerCase() === normalized)
        .map((row) => [proofKey({ originTxHash: row.ticket.originTxHash, logIndex: BigInt(row.ticket.logIndex) } as MegasteraProof), row] as const),
    );
    return [...this.proofRows.values()]
      .filter((proof) => proof.recipient.toLowerCase() === normalized)
      .sort((left, right) => (right.ticketId > left.ticketId ? 1 : right.ticketId < left.ticketId ? -1 : 0))
      .map((proof) => {
        const generatedRow = generated.get(proofKey(proof));
        return generatedRow
          ? { generationStatus: 'generated', ticket: generatedRow.ticket, planet: withoutGifData(generatedRow) }
          : { generationStatus: 'pending', ticket: ticketFromProof(proof), planet: null, generationError: null };
      });
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
