import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

type BlurTextProps = {
  text: string;
  className?: string;
  delay?: number;
};

/**
 * Compact heading reveal adapted from React Bits BlurText.
 * https://github.com/DavidHDev/react-bits
 */
export function BlurText({ text, className = '', delay = 70 }: BlurTextProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [inView, setInView] = useState(false);
  const reduceMotion = useReducedMotion();
  const segments = text.split('');

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (reduceMotion || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setInView(true);
        observer.unobserve(element);
      },
      { threshold: 0.1 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [reduceMotion]);

  return (
    <span ref={ref} data-react-bits="blur-text" className={`inline-flex ${className}`} aria-label={text}>
      {segments.map((character, index) => (
        <motion.span
          key={`${character}-${index}`}
          aria-hidden="true"
          initial={reduceMotion ? false : { opacity: 0, filter: 'blur(8px)', y: -8 }}
          animate={
            inView || reduceMotion
              ? { opacity: 1, filter: 'blur(0px)', y: 0 }
              : { opacity: 0, filter: 'blur(8px)', y: -8 }
          }
          transition={{
            duration: reduceMotion ? 0 : 0.42,
            delay: reduceMotion ? 0 : (index * delay) / 1000,
            ease: 'easeOut',
          }}
          style={{ display: 'inline-block', willChange: 'transform, filter, opacity' }}
        >
          {character === ' ' ? '\u00A0' : character}
        </motion.span>
      ))}
    </span>
  );
}
