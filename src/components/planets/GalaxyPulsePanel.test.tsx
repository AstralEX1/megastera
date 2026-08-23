// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { GalaxyPulsePanel } from './GalaxyPulsePanel';

const pulse = {
  drawingId: '8421',
  settledAt: '2026-08-22T12:34:56.000Z',
  slots: [
    { planetType: 'Gaia', modifierBps: 125 },
    { planetType: 'Gaia', modifierBps: -50 },
    { planetType: 'Volcanic', modifierBps: 0 },
    { planetType: 'Toxic', modifierBps: 100 },
  ],
} as const;

describe('GalaxyPulsePanel', () => {
  afterEach(cleanup);

  it('shows a neutral empty state when there is no active pulse', () => {
    render(<GalaxyPulsePanel pulse={null} />);

    expect(screen.getByRole('heading', { name: 'Galaxy Pulse' })).toBeInTheDocument();
    expect(screen.getByText('No active Galaxy Pulse')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('renders each raw slot in order with its type icon and signed percentage', () => {
    render(<GalaxyPulsePanel pulse={pulse} />);

    const panel = screen.getByTestId('galaxy-pulse-panel');
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items).toHaveLength(4);
    expect(items.map((item) => item.textContent)).toEqual([
      'Gaia+1.25%',
      'Gaia-0.5%',
      'Volcanic+0%',
      'Toxic+1%',
    ]);
    expect(within(panel).getAllByText('Gaia')).toHaveLength(2);
    expect(screen.getByText('DRAWING #8421')).toBeInTheDocument();
    expect(screen.getByText('Settled Aug 22, 12:34 UTC')).toBeInTheDocument();
    expect(screen.getByText('Settled Aug 22, 12:34 UTC')).toHaveAttribute(
      'datetime',
      '2026-08-22T12:34:56.000Z',
    );
    const icons = panel.querySelectorAll('img');
    expect(icons).toHaveLength(4);
    expect(icons[0]).toHaveAttribute('src', '/galaxy-pulse/gaia.png');
    expect(icons[1]).toHaveAttribute('src', '/galaxy-pulse/gaia.png');
    expect(icons[2]).toHaveAttribute('src', '/galaxy-pulse/volcanic.png');
    expect(icons[3]).toHaveAttribute('src', '/galaxy-pulse/toxic.png');
    expect(icons[0]).toHaveAttribute('alt', '');
  });
});
