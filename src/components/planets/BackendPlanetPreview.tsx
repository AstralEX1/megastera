import { derivePlanetPreview, type PlanetPreview } from '@megaplanets/planet-generator';
import { useMemo } from 'react';
import { PLANET_CONFIG } from '@/config/planetConfig';
import type { BackendPlanet } from '@/lib/backendApi';
import { PlanetThumbnail } from './PlanetThumbnail';

export function createBackendPlanetPreview(planet: BackendPlanet): PlanetPreview {
  return derivePlanetPreview(
    {
      ticketId: BigInt(planet.ticket.ticketId),
      drawingId: BigInt(planet.ticket.drawingId),
      normals: planet.ticket.normals,
      bonusBall: planet.ticket.bonusBall,
      originTxHash: planet.ticket.originTxHash,
    },
    PLANET_CONFIG,
  );
}

/** A deterministic first frame for collection cards; GIF encoding stays detail-only. */
export function BackendPlanetPreview({ planet }: { planet: BackendPlanet }) {
  const preview = useMemo(() => createBackendPlanetPreview(planet), [planet]);

  return (
    <div data-testid={`planet-static-preview-${planet.planetId}`} className="h-full w-full">
      <PlanetThumbnail descriptor={preview.visual} />
    </div>
  );
}
