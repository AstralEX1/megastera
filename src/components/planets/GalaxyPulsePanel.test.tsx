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

const lowercasePulse = {
  drawingId: '151',
  settledAt: '2026-08-22T17:00:00.000Z',
  slots: [
    { planetType: 'nebula', modifierBps: -2691 },
    { planetType: 'rocky', modifierBps: 2066 },
    { planetType: 'triplex', modifierBps: -1576 },
    { planetType: 'toxic', modifierBps: 4494 },
  ],
} as const;

describe('GalaxyPulsePanel', () => {
  afterEach(cleanup);

  it('shows a neutral empty state when there is no active pulse', () => {
    render(<GalaxyPulsePanel pulse={null} />);

    expect(screen.getByRole('heading', { name: 'GALAXY PULSE' })).toBeInTheDocument();
    expect(screen.getAllByText('No active GALAXY PULSE')).toHaveLength(2);
    expect(screen.queryByText('ACTIVE DRAWING')).not.toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('renders each raw slot in order with its type icon and signed percentage', () => {
    render(<GalaxyPulsePanel pulse={pulse} />);

    const panel = screen.getByTestId('galaxy-pulse-panel');
    const tooltip = screen.getByRole('tooltip');
    expect(within(panel).getByRole('heading', { name: 'GALAXY PULSE' })).toBeInTheDocument();
    expect(within(tooltip).getByText('GALAXY PULSE')).toBeInTheDocument();
    const items = within(tooltip).getAllByRole('listitem');
    expect(items).toHaveLength(4);
    expect(items.map((item) => item.textContent)).toEqual([
      'Gaia+1.25%',
      'Gaia-0.5%',
      'Volcanic+0%',
      'Toxic+1%',
    ]);
    expect(within(panel).getAllByText('Gaia')).toHaveLength(2);
    expect(within(tooltip).getByText('DRAWING #8421')).toBeInTheDocument();
    expect(within(tooltip).getByText('Settled Aug 22, 12:34 UTC')).toBeInTheDocument();
    expect(within(tooltip).getByText('Settled Aug 22, 12:34 UTC')).toHaveAttribute(
      'datetime',
      '2026-08-22T12:34:56.000Z',
    );
    const icons = tooltip.querySelectorAll('img');
    expect(icons).toHaveLength(4);
    expect(icons[0]).toHaveAttribute('src', '/galaxy-pulse/gaia.png');
    expect(icons[1]).toHaveAttribute('src', '/galaxy-pulse/gaia.png');
    expect(icons[2]).toHaveAttribute('src', '/galaxy-pulse/volcanic.png');
    expect(icons[3]).toHaveAttribute('src', '/galaxy-pulse/toxic.png');
    expect(icons[0]).toHaveAttribute('alt', '');
  });

  it('loads icons for canonical lowercase planet type ids', () => {
    render(<GalaxyPulsePanel pulse={lowercasePulse} />);

    const icons = screen.getByRole('tooltip').querySelectorAll('img');
    expect([...icons].map((icon) => icon.getAttribute('src'))).toEqual([
      '/galaxy-pulse/nebula.png',
      '/galaxy-pulse/rocky.png',
      '/galaxy-pulse/triplex.png',
      '/galaxy-pulse/toxic.png',
    ]);
  });

  it('uses a red-violet gradient frame for the header and tooltip', () => {
    render(<GalaxyPulsePanel pulse={pulse} />);

    const gradientClasses = [
      'bg-gradient-to-r',
      'from-red-500',
      'via-fuchsia-500',
      'to-violet-600',
    ];
    expect(screen.getByTestId('galaxy-pulse-frame')).toHaveClass(...gradientClasses);
    expect(screen.getByRole('tooltip')).toHaveClass(...gradientClasses);
  });

  it('exposes a detailed tooltip with the pulse explanation and effects', () => {
    render(<GalaxyPulsePanel pulse={pulse} />);

    const trigger = screen.getByTestId('galaxy-pulse-tooltip-trigger');
    const tooltip = screen.getByRole('tooltip');

    expect(trigger).toHaveAttribute('type', 'button');
    expect(trigger).toHaveAttribute('aria-describedby', 'galaxy-pulse-details');
    expect(tooltip).toHaveTextContent(
      'GALAXY PULSE is a set of mining modifiers selected for this drawing.',
    );
    expect(tooltip).toHaveTextContent('Each effect applies to planets of the matching type.');
    expect(within(tooltip).getByRole('heading', { name: 'Effects' })).toBeInTheDocument();
    expect(within(tooltip).getAllByRole('listitem')).toHaveLength(4);
    expect(
      within(tooltip)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Gaia+1.25%', 'Gaia-0.5%', 'Volcanic+0%', 'Toxic+1%']);
  });
});
