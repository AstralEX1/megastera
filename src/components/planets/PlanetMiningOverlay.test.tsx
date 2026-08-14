// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PlanetMiningOverlay } from './PlanetMiningOverlay';

const mining = {
  tokenId: '7',
  planetType: 'Nebula',
  sameTypeCount: 3,
  collectionBonusBps: 500,
  baseMineralsPerDay: '24',
  effectiveMineralsPerDayMicros: '25200000',
  earnedMicros: '10100000',
  activeSince: '2026-08-10T00:00:00.000Z',
};

describe('PlanetMiningOverlay', () => {
  afterEach(cleanup);

  it('maps the backend mining snapshot into the intrinsic production metrics', () => {
    render(<PlanetMiningOverlay mining={mining} miningAsOf="2026-08-10T00:00:01.000Z" />);
    expect(screen.getByTestId('planet-mining-overlay')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Minerals' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Mined' })).toBeInTheDocument();
    expect(screen.getByText('25.2')).toHaveClass('text-[var(--rare)]');
    expect(screen.queryByText('24')).not.toBeInTheDocument();
    expect(screen.getByText('10.1')).toBeInTheDocument();
    expect(screen.queryByText('/day')).not.toBeInTheDocument();
    expect(screen.queryByText('mined')).not.toBeInTheDocument();
    expect(screen.getByText('+5%')).toHaveClass('text-[var(--rare)]');
    expect(screen.queryByText('MINERALS / DAY')).not.toBeInTheDocument();
    expect(screen.queryByText('MINED')).not.toBeInTheDocument();
    expect(screen.queryByText('3 SAME TYPE')).not.toBeInTheDocument();
  });

  it('shows collection progress when the same-type bonus is not active', () => {
    render(
      <PlanetMiningOverlay
        mining={{ ...mining, sameTypeCount: 2, collectionBonusBps: 0 }}
        miningAsOf="2026-08-10T00:00:01.000Z"
      />,
    );
    expect(screen.getByText('+0%')).toBeInTheDocument();
    expect(screen.getByText('+0%')).toHaveClass('text-[var(--text-secondary)]');
    expect(screen.queryByText(/SAME TYPE/)).not.toBeInTheDocument();
  });

  it('does not invent mining values when the backend snapshot is unavailable', () => {
    render(<PlanetMiningOverlay />);
    expect(screen.getByText('Mining unavailable')).toBeInTheDocument();
    expect(screen.queryByText('+0%')).not.toBeInTheDocument();
  });

  it('supports a compact card treatment for mining metrics', () => {
    render(<PlanetMiningOverlay mining={mining} miningAsOf="2026-08-10T00:00:01.000Z" variant="compact" />);
    const overlay = screen.getByTestId('planet-mining-overlay');
    expect(overlay).toHaveClass('inset-x-2', 'bottom-2');
    expect(overlay.querySelector(':scope > div')).toHaveClass('p-2');
    expect(screen.getByRole('img', { name: 'Minerals' })).toHaveClass('h-4', 'w-4');
    expect(screen.getByRole('img', { name: 'Mined' })).toHaveClass('h-4', 'w-4', 'bg-white');
    expect(screen.getByText('25.2')).toHaveClass('text-sm', 'text-[var(--rare)]');
  });
});
