import { derivePlanetPreview, type PlanetPreview } from '@megaplanets/planet-generator';
import { PLANET_CONFIG } from '@/config/planetConfig';

const PREVIEW_ORIGIN_TX_HASH = `0x${'51'.repeat(32)}` as `0x${string}`;
const MIN_TICKET_NUMBER = 1_000;
const TICKET_NUMBER_RANGE = 999_000;

function randomUint32(): number {
  const values = new Uint32Array(1);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(values);
    return values[0];
  }
  return Date.now() >>> 0;
}

function createPreview(ticketNumber: number): PlanetPreview {
  const normalStart = (ticketNumber * 13) % 255;
  const normals = Array.from({ length: 5 }, (_, index) => ((normalStart + index * 31) % 255) + 1);

  return derivePlanetPreview(
    {
      ticketId: BigInt(ticketNumber),
      drawingId: BigInt(700 + (ticketNumber % 97)),
      normals,
      bonusBall: ((ticketNumber * 17) % 255) + 1,
      originTxHash: PREVIEW_ORIGIN_TX_HASH,
    },
    PLANET_CONFIG,
  );
}

export function createRandomLandingPlanetPreviews(
  count: number,
  excludedTicketNumbers: readonly number[] = [],
): PlanetPreview[] {
  const used = new Set(excludedTicketNumbers);
  return Array.from({ length: count }, () => {
    let ticketNumber = MIN_TICKET_NUMBER + (randomUint32() % TICKET_NUMBER_RANGE);
    while (used.has(ticketNumber)) {
      ticketNumber = MIN_TICKET_NUMBER + ((ticketNumber - MIN_TICKET_NUMBER + 1) % TICKET_NUMBER_RANGE);
    }
    used.add(ticketNumber);
    return createPreview(ticketNumber);
  });
}
