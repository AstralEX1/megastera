// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/layout/Layout', () => ({
  Layout: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
vi.mock('@/pages/Landing', () => ({ Landing: () => null }));
vi.mock('@/pages/Leaderboard', () => ({ Leaderboard: () => null }));
vi.mock('@/pages/Play', () => ({ Play: () => null }));
vi.mock('@/pages/Tickets', () => ({ Tickets: () => null }));
vi.mock('@/pages/ComingSoon', () => ({ ComingSoon: () => null }));
vi.mock('@/pages/Planets', () => ({
  Planets: ({ onViewPlanet }: { onViewPlanet: (planetId: string) => void }) => (
    <button type="button" onClick={() => onViewPlanet('planet-1')}>
      Open planet
    </button>
  ),
}));

import App from './App';

describe('App navigation', () => {
  afterEach(() => {
    cleanup();
    window.history.replaceState({}, '', '/');
    vi.restoreAllMocks();
  });

  it('keeps the current scroll position when opening a planet', async () => {
    window.history.replaceState({}, '', '/my-planets');
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);

    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Open planet' }));

    expect(scrollTo).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe('/planet/planet-1');
  });
});
