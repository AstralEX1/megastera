import { useCallback, useState } from 'react';
import { PlanetGif } from '@/components/planets/PlanetGif';
import { createRandomLandingPlanetPreviews } from './landingPlanetPreview';
import { LandingSplitText } from './LandingSplitText';

export function PlanetGeneratorHero() {
  const [preview, setPreview] = useState(() => createRandomLandingPlanetPreviews(1)[0]);
  const generatePlanet = useCallback(() => {
    setPreview((current) =>
      createRandomLandingPlanetPreviews(1, [Number(current.descriptor.input.ticketId)])[0],
    );
  }, []);

  return (
    <article
      className="landing-live-generator"
      aria-label="Interactive Planet preview"
      data-planet-visual-seed={preview.visualTraitsHash}
    >
      <div className="landing-live-generator-art">
        <PlanetGif key={preview.visualTraitsHash} preview={preview} deferGeneration />
        <button className="landing-live-generator-button" type="button" onClick={generatePlanet}>
          <LandingSplitText text="Tap" className="landing-button-label" />
        </button>
      </div>
    </article>
  );
}
