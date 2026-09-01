// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MobileBottomNav, Nav } from './Nav';

describe('primary navigation', () => {
  afterEach(cleanup);

  it('does not expose Ticket status in desktop or mobile primary navigation', () => {
    const onSelect = vi.fn();
    render(
      <>
        <Nav active="play" onSelect={onSelect} />
        <MobileBottomNav active="play" onSelect={onSelect} />
      </>,
    );

    expect(screen.queryAllByRole('button', { name: 'Ticket status' })).toHaveLength(0);
  });

  it('labels the roadmap destination as Season 1 Finale in desktop and mobile navigation', () => {
    const onSelect = vi.fn();
    render(
      <>
        <Nav active="play" onSelect={onSelect} />
        <MobileBottomNav active="play" onSelect={onSelect} />
      </>,
    );

    expect(screen.getAllByRole('button', { name: 'Season 1 Finale' })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Coming Soon' })).not.toBeInTheDocument();
  });
});
