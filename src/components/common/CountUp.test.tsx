// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const springState = vi.hoisted(() => ({ options: null as Record<string, unknown> | null }));

vi.mock('motion/react', () => ({
  useInView: () => false,
  useMotionValue: (initial: number) => ({ initial, set: vi.fn() }),
  useSpring: (_value: unknown, options: Record<string, unknown>) => {
    springState.options = options;
    return { on: () => () => undefined };
  },
}));

import CountUp from './CountUp';

describe('CountUp', () => {
  it('uses the requested visual duration for the spring', () => {
    render(<CountUp to={100} duration={0.5} />);

    expect(springState.options).toEqual({ visualDuration: 0.5, bounce: 0 });
  });
});
