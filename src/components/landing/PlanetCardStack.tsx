import { motion, type PanInfo, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import { LandingPlanetCard } from './LandingPlanetCard';

// Interaction adapted from React Bits Stack (MIT + Commons Clause).
const planets = [
  { id: '006', name: 'Vesper Arc', type: 'Toxic', rarity: 'Epic', rate: '4.82' },
  { id: '017', name: 'Kairox Bloom', type: 'Gaia', rarity: 'Legendary', rate: '6.14' },
  { id: '029', name: 'Nereid Rift', type: 'Oceanic', rarity: 'Uncommon', rate: '3.27' },
  { id: '039', name: 'Cinder-39', type: 'Volcanic', rarity: 'Epic', rate: '5.08' },
  { id: '055', name: 'Pelagos', type: 'Gaia', rarity: 'Common', rate: '2.91' },
  { id: '067', name: 'Ion Veil', type: 'Toxic', rarity: 'Legendary', rate: '6.72' },
  { id: '092', name: 'Orison Belt', type: 'Desert', rarity: 'Uncommon', rate: '3.64' },
] as const;

export function PlanetCardStack() {
  const [order, setOrder] = useState(() => planets.map((_, index) => index));
  const [paused, setPaused] = useState(false);
  const reduceMotion = useReducedMotion();

  const next = () => setOrder((current) => [current[current.length - 1], ...current.slice(0, -1)]);
  const previous = () => setOrder((current) => [...current.slice(1), current[0]]);

  useEffect(() => {
    if (paused || reduceMotion) return;
    const timer = window.setInterval(
      () => setOrder((current) => [current[current.length - 1], ...current.slice(0, -1)]),
      4500,
    );
    return () => window.clearInterval(timer);
  }, [paused, reduceMotion]);

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (Math.abs(info.offset.x) > 80 || Math.abs(info.offset.y) > 80) next();
  };

  return (
    <section
      className="landing-planet-stack-shell"
      aria-label="Planet discovery carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="landing-planet-stack" aria-live="polite">
        {order.map((planetIndex, index) => {
          const planet = planets[planetIndex];
          const active = index === order.length - 1;
          const depth = order.length - index - 1;
          return (
            <motion.div
              className="landing-planet-stack-item"
              key={planet.id}
              style={{ zIndex: index }}
              animate={{
                x: depth * 10,
                y: depth * -8,
                rotateZ: depth * 1.7,
                scale: 1 - depth * 0.035,
              }}
              transition={{ type: 'spring', stiffness: 260, damping: 24 }}
              drag={active && !reduceMotion}
              dragConstraints={{ top: 0, right: 0, bottom: 0, left: 0 }}
              dragElastic={0.55}
              onDragEnd={handleDragEnd}
            >
              <LandingPlanetCard
                image={`/landing/${active ? 'gifs-512' : 'png'}/planet-${planet.id}.${active ? 'gif' : 'png'}`}
                name={planet.name}
                type={planet.type}
                rarity={planet.rarity}
                ticketId={`50${planet.id}`}
                rate={planet.rate}
                active={active}
              />
            </motion.div>
          );
        })}
      </div>
      <div className="landing-planet-stack-controls">
        <button type="button" onClick={previous} aria-label="Show previous Planet">
          ←
        </button>
        <span className="landing-planet-stack-drag-cue">
          <span className="landing-planet-stack-drag-visual" aria-hidden="true">
            <i>←</i><b /><i>→</i>
          </span>
          <span>DRAG PLANETS</span>
        </span>
        <button type="button" onClick={next} aria-label="Show next Planet">
          →
        </button>
      </div>
    </section>
  );
}
