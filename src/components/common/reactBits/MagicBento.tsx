import { gsap } from 'gsap';
import type { CSSProperties, PropsWithChildren } from 'react';
import { useEffect, useRef } from 'react';
import './MagicBento.css';

type MagicBentoProps = PropsWithChildren<{
  textAutoHide?: boolean;
  enableStars?: boolean;
  enableSpotlight?: boolean;
  enableBorderGlow?: boolean;
  disableAnimations?: boolean;
  spotlightRadius?: number;
  particleCount?: number;
  enableTilt?: boolean;
  glowColor?: string;
  clickEffect?: boolean;
  enableMagnetism?: boolean;
  className?: string;
  testId?: string;
}>;

type MagicBentoStyle = CSSProperties & {
  '--magic-bento-glow': string;
  '--magic-bento-radius': string;
};

const DEFAULT_PARTICLE_COUNT = 12;
const DEFAULT_SPOTLIGHT_RADIUS = 300;
const DEFAULT_GLOW_COLOR = '132, 0, 255';

function createParticleElement(x: number, y: number, color: string): HTMLSpanElement {
  const particle = document.createElement('span');
  particle.className = 'magic-bento-particle';
  particle.style.left = `${x}px`;
  particle.style.top = `${y}px`;
  particle.style.background = `rgba(${color}, 1)`;
  particle.style.boxShadow = `0 0 6px rgba(${color}, 0.6)`;
  return particle;
}

export default function MagicBento({
  children,
  className = '',
  testId,
  enableStars = true,
  enableSpotlight = true,
  enableBorderGlow = true,
  disableAnimations = false,
  spotlightRadius = DEFAULT_SPOTLIGHT_RADIUS,
  particleCount = DEFAULT_PARTICLE_COUNT,
  enableTilt = false,
  glowColor = DEFAULT_GLOW_COLOR,
  clickEffect = true,
  enableMagnetism = true,
}: MagicBentoProps) {
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = frameRef.current;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (!element || disableAnimations || reducedMotion) return;

    const particles = new Set<HTMLSpanElement>();
    const particleTimers: ReturnType<typeof setTimeout>[] = [];
    let isHovered = false;

    const clearParticles = () => {
      particleTimers.forEach(clearTimeout);
      particleTimers.length = 0;
      particles.forEach((particle) => {
        gsap.killTweensOf(particle);
        particle.remove();
      });
      particles.clear();
    };

    const animateParticles = () => {
      if (!enableStars) return;

      clearParticles();
      const { width, height } = element.getBoundingClientRect();
      for (let index = 0; index < particleCount; index += 1) {
        const timer = setTimeout(() => {
          if (!isHovered) return;

          const particle = createParticleElement(
            Math.random() * width,
            Math.random() * height,
            glowColor,
          );
          element.appendChild(particle);
          particles.add(particle);
          gsap.fromTo(
            particle,
            { scale: 0, opacity: 0 },
            { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(1.7)' },
          );
          gsap.to(particle, {
            x: (Math.random() - 0.5) * 80,
            y: (Math.random() - 0.5) * 80,
            rotation: Math.random() * 360,
            duration: 2 + Math.random() * 2,
            ease: 'none',
            repeat: -1,
            yoyo: true,
          });
          gsap.to(particle, {
            opacity: 0.3,
            duration: 1.5,
            ease: 'power2.inOut',
            repeat: -1,
            yoyo: true,
          });
        }, index * 70);
        particleTimers.push(timer);
      }
    };

    const handleMouseEnter = () => {
      isHovered = true;
      element.style.setProperty('--magic-bento-glow-opacity', enableBorderGlow ? '0.45' : '0');
      element.style.setProperty('--magic-bento-glow-soft', enableBorderGlow ? '0.2' : '0');
      animateParticles();
    };

    const handleMouseMove = (event: MouseEvent) => {
      const rect = element.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      if (enableSpotlight) {
        element.style.setProperty('--magic-bento-x', `${(x / rect.width) * 100}%`);
        element.style.setProperty('--magic-bento-y', `${(y / rect.height) * 100}%`);
        element.style.setProperty('--magic-bento-glow-opacity', enableBorderGlow ? '0.95' : '0');
        element.style.setProperty('--magic-bento-glow-soft', enableBorderGlow ? '0.35' : '0');
      }

      if (enableTilt || enableMagnetism) {
        gsap.to(element, {
          rotateX: enableTilt ? ((y - centerY) / centerY) * -10 : 0,
          rotateY: enableTilt ? ((x - centerX) / centerX) * 10 : 0,
          x: enableMagnetism ? (x - centerX) * 0.05 : 0,
          y: enableMagnetism ? (y - centerY) * 0.05 : 0,
          duration: 0.1,
          ease: 'power2.out',
          transformPerspective: 1000,
        });
      }
    };

    const handleMouseLeave = () => {
      isHovered = false;
      clearParticles();
      element.style.setProperty('--magic-bento-glow-opacity', '0');
      element.style.setProperty('--magic-bento-glow-soft', '0');
      if (enableTilt || enableMagnetism) {
        gsap.to(element, { rotateX: 0, rotateY: 0, x: 0, y: 0, duration: 0.3, ease: 'power2.out' });
      }
    };

    const handleClick = (event: MouseEvent) => {
      if (!clickEffect) return;

      const rect = element.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const radius = Math.max(
        Math.hypot(x, y),
        Math.hypot(x - rect.width, y),
        Math.hypot(x, y - rect.height),
        Math.hypot(x - rect.width, y - rect.height),
      );
      const ripple = document.createElement('span');
      ripple.className = 'magic-bento-ripple';
      ripple.style.width = `${radius * 2}px`;
      ripple.style.height = `${radius * 2}px`;
      ripple.style.left = `${x - radius}px`;
      ripple.style.top = `${y - radius}px`;
      ripple.style.background = `radial-gradient(circle, rgba(${glowColor}, 0.4) 0%, rgba(${glowColor}, 0.2) 30%, transparent 70%)`;
      element.appendChild(ripple);
      gsap.fromTo(
        ripple,
        { scale: 0, opacity: 1 },
        {
          scale: 1,
          opacity: 0,
          duration: 0.8,
          ease: 'power2.out',
          onComplete: () => ripple.remove(),
        },
      );
    };

    element.addEventListener('mouseenter', handleMouseEnter);
    element.addEventListener('mousemove', handleMouseMove);
    element.addEventListener('mouseleave', handleMouseLeave);
    element.addEventListener('click', handleClick);

    return () => {
      isHovered = false;
      clearParticles();
      gsap.killTweensOf(element);
      element.removeEventListener('mouseenter', handleMouseEnter);
      element.removeEventListener('mousemove', handleMouseMove);
      element.removeEventListener('mouseleave', handleMouseLeave);
      element.removeEventListener('click', handleClick);
    };
  }, [
    clickEffect,
    disableAnimations,
    enableBorderGlow,
    enableMagnetism,
    enableSpotlight,
    enableStars,
    enableTilt,
    glowColor,
    particleCount,
  ]);

  const style: MagicBentoStyle = {
    '--magic-bento-glow': glowColor,
    '--magic-bento-radius': `${spotlightRadius}px`,
  };

  return (
    <div
      ref={frameRef}
      data-react-bits="magic-bento"
      data-testid={testId}
      className={[
        'magic-bento-frame',
        enableBorderGlow ? 'magic-bento-border-glow' : '',
        enableSpotlight ? 'magic-bento-spotlight' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={style}
    >
      {children}
    </div>
  );
}
