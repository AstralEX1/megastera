import { PLANET_TYPES, type PlanetTypeId } from '@megaplanets/planet-generator';
import { type Address, encodeAbiParameters, type Hex, keccak256 } from 'viem';

export const GALAXY_PULSE_ALGORITHM_VERSION = 'MEGASTERA_GALAXY_PULSE_V1' as const;

const SLOT_COUNT = 4;
const BPS_RANGE = 10_001n;

export type GalaxyPulseInput = {
  drawingId: bigint;
  entropy: Hex;
  chainId: number;
  jackpotAddress: Address;
};

export type GalaxyPulseSlot = {
  planetType: PlanetTypeId;
  modifierBps: number;
};

function deriveRootSeed(input: GalaxyPulseInput): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: 'string', name: 'algorithm' },
        { type: 'uint256', name: 'chainId' },
        { type: 'address', name: 'jackpotAddress' },
        { type: 'uint256', name: 'drawingId' },
        { type: 'bytes32', name: 'entropy' },
      ],
      [
        GALAXY_PULSE_ALGORITHM_VERSION,
        BigInt(input.chainId),
        input.jackpotAddress,
        input.drawingId,
        input.entropy,
      ],
    ),
  );
}

function deriveSlotSeed(rootSeed: Hex, slotIndex: number): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: 'bytes32', name: 'rootSeed' },
        { type: 'uint256', name: 'slotIndex' },
      ],
      [rootSeed, BigInt(slotIndex)],
    ),
  );
}

export function deriveGalaxyPulseV1(input: GalaxyPulseInput): readonly GalaxyPulseSlot[] {
  const rootSeed = deriveRootSeed(input);
  return Array.from({ length: SLOT_COUNT }, (_, slotIndex) => {
    const value = BigInt(deriveSlotSeed(rootSeed, slotIndex));
    const planetType = PLANET_TYPES[Number(value % BigInt(PLANET_TYPES.length))];
    if (!planetType) throw new Error('Canonical Planet type is missing.');
    return {
      planetType,
      modifierBps: Number((value >> 8n) % BPS_RANGE) - 5_000,
    };
  });
}

export function aggregateGalaxyPulseByType(
  slots: readonly GalaxyPulseSlot[],
): Map<PlanetTypeId, number> {
  const byType = new Map<PlanetTypeId, number>();
  for (const slot of slots) {
    byType.set(slot.planetType, (byType.get(slot.planetType) ?? 0) + slot.modifierBps);
  }
  return byType;
}

export function resolveGalaxyPulseBps(
  byType: ReadonlyMap<string, number>,
  storedPlanetType: string,
): number {
  return byType.get(storedPlanetType.toLowerCase()) ?? 0;
}
