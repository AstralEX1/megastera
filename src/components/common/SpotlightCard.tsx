import type { HTMLAttributes, PropsWithChildren } from 'react';
import { useRef, useState } from 'react';

type SpotlightCardProps = PropsWithChildren<
  HTMLAttributes<HTMLDivElement> & {
    spotlightColor?: string;
  }
>;

/**
 * Pointer spotlight interaction adapted for Megastera from the React Bits
 * SpotlightCard concept: https://github.com/DavidHDev/react-bits
 * React Bits copyright (c) 2026 David Haz, used under its MIT + Commons Clause terms.
 */
export function SpotlightCard({
  children,
  className = '',
  spotlightColor = 'rgba(174, 185, 255, 0.18)',
  onPointerMove,
  onPointerEnter,
  onPointerLeave,
  ...props
}: SpotlightCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [spotlight, setSpotlight] = useState({ x: 0, y: 0, opacity: 0 });

  return (
    <div
      {...props}
      ref={cardRef}
      data-react-bits="spotlight-card"
      className={`relative overflow-hidden ${className}`}
      onPointerMove={(event) => {
        onPointerMove?.(event);
        const rect = cardRef.current?.getBoundingClientRect();
        if (!rect) return;
        setSpotlight({ x: event.clientX - rect.left, y: event.clientY - rect.top, opacity: 1 });
      }}
      onPointerEnter={(event) => {
        onPointerEnter?.(event);
        setSpotlight((current) => ({ ...current, opacity: 1 }));
      }}
      onPointerLeave={(event) => {
        onPointerLeave?.(event);
        setSpotlight((current) => ({ ...current, opacity: 0 }));
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 transition-opacity duration-300 motion-reduce:transition-none"
        style={{
          opacity: spotlight.opacity,
          background: `radial-gradient(360px circle at ${spotlight.x}px ${spotlight.y}px, ${spotlightColor}, transparent 72%)`,
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
