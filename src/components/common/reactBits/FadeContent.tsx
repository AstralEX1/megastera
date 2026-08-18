import type { PropsWithChildren } from 'react';
import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';

type FadeContentProps = PropsWithChildren<{
  className?: string;
  delay?: number;
  duration?: number;
  blur?: boolean;
  threshold?: number;
}>;

/**
 * Restrained viewport reveal adapted from the React Bits FadeContent concept.
 * https://github.com/DavidHDev/react-bits
 */
export function FadeContent({
  children,
  className = '',
  delay = 0,
  duration = 0.55,
  blur = true,
  threshold = 0.12,
}: FadeContentProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const reduceMotion = useReducedMotion();

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
      { threshold },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [reduceMotion, threshold]);

  const hidden = {
    opacity: 0,
    y: 8,
    filter: blur ? 'blur(6px)' : 'blur(0px)',
  };

  return (
    <motion.div
      ref={ref}
      data-react-bits="fade-content"
      className={className}
      initial={reduceMotion ? false : hidden}
      animate={inView || reduceMotion ? { opacity: 1, y: 0, filter: 'blur(0px)' } : hidden}
      transition={{ duration: reduceMotion ? 0 : duration, delay: reduceMotion ? 0 : delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}
