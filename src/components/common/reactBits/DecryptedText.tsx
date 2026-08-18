import { useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type DecryptedTextProps = {
  text: string;
  className?: string;
  encryptedClassName?: string;
  characters?: string;
  speed?: number;
  iterations?: number;
};

/**
 * View-triggered telemetry reveal adapted from React Bits DecryptedText.
 * https://github.com/DavidHDev/react-bits
 */
export function DecryptedText({
  text,
  className = '',
  encryptedClassName = '',
  characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789./:-_',
  speed = 42,
  iterations = 8,
}: DecryptedTextProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [displayText, setDisplayText] = useState(text);
  const [hasAnimated, setHasAnimated] = useState(false);
  const reduceMotion = useReducedMotion();
  const characterPool = useMemo(() => characters.split(''), [characters]);

  const scramble = useCallback(
    (progress: number) =>
      text
        .split('')
        .map((character, index) => {
          if (character === ' ') return ' ';
          if (index / Math.max(1, text.length - 1) <= progress) return character;
          return characterPool[Math.floor(Math.random() * characterPool.length)] ?? character;
        })
        .join(''),
    [characterPool, text],
  );

  const animate = useCallback(() => {
    if (hasAnimated || reduceMotion) {
      setDisplayText(text);
      return;
    }

    let step = 0;
    setHasAnimated(true);
    timerRef.current = setInterval(() => {
      step += 1;
      const progress = Math.min(1, step / iterations);
      setDisplayText(progress >= 1 ? text : scramble(progress));
      if (progress >= 1 && timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }, speed);
  }, [hasAnimated, iterations, reduceMotion, scramble, speed, text]);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (reduceMotion || typeof IntersectionObserver === 'undefined') {
      setDisplayText(text);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        animate();
        observer.unobserve(element);
      },
      { threshold: 0.1 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [animate, reduceMotion, text]);

  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
    },
    [],
  );

  return (
    <span ref={ref} data-react-bits="decrypted-text" className="inline-block whitespace-pre-wrap">
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {displayText.split('').map((character, index) => (
          <span key={`${index}-${character}`} className={displayText === text ? className : encryptedClassName}>
            {character}
          </span>
        ))}
      </span>
    </span>
  );
}
