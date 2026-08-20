// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PlanetMiningOverlay } from './PlanetMiningOverlay';

const mining = {
  planetId: 'planet-1',
  planetType: 'Nebula',
  sameTypeCount: 3,
  collectionBonusBps: 500,
  baseMineralsPerDay: '24',
  effectiveMineralsPerDayMicros: '25200000',
  upgradeLevel: 1,
  upgradeBonusBps: 1000,
  nextUpgrade: { targetLevel: 2, bonusBpsAfter: 2500, costMicros: '300000' },
};

describe('PlanetMiningOverlay', () => {
  afterEach(cleanup);

  it('maps the backend mining snapshot into the intrinsic production metrics', () => {
    render(<PlanetMiningOverlay mining={mining} />);
    expect(screen.getByTestId('planet-mining-overlay')).toBeInTheDocument();
    expect(screen.getByText('RATE')).toBeInTheDocument();
    expect(screen.getByText('BOOST')).toBeInTheDocument();
    const rate = screen.getByText('RATE');
    const boost = screen.getByText('BOOST');
    expect(rate.compareDocumentPosition(boost) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const rateTooltip = screen.getByRole('tooltip', { name: 'Minerals per day including boost' });
    const boostTooltip = screen.getByRole('tooltip', { name: 'Bonus from matching planet types' });
    expect(rateTooltip).toHaveClass('h-[22px]', 'px-2', 'text-[10px]', 'font-medium', 'duration-150', 'group-hover/metric:opacity-100');
    expect(rateTooltip).not.toHaveClass('group-hover:opacity-100');
    expect(boostTooltip).toHaveClass('h-[22px]', 'px-2', 'text-[10px]', 'font-medium', 'duration-150');
    expect(boostTooltip).toHaveClass('group-hover/metric:opacity-100');
    expect(screen.queryByRole('tooltip', { name: 'Total minerals collected' })).not.toBeInTheDocument();
    expect(screen.queryByTitle('Minerals per day after all collection bonuses')).not.toBeInTheDocument();
    expect(screen.getByText('25.2')).toHaveClass('text-[var(--rare)]');
    expect(screen.queryByText('24')).not.toBeInTheDocument();
    expect(screen.queryByText('10.1')).not.toBeInTheDocument();
    expect(screen.getByText('+5%')).toHaveClass('text-[var(--rare)]');
    expect(screen.queryByText('MINERALS / DAY')).not.toBeInTheDocument();
  });

  it('shows collection progress when the same-type bonus is not active', () => {
    render(
      <PlanetMiningOverlay
        mining={{ ...mining, sameTypeCount: 2, collectionBonusBps: 0 }}
      />,
    );
    expect(screen.getByText('+0%')).toBeInTheDocument();
    expect(screen.getByText('+0%')).toHaveClass('text-[var(--text-secondary)]');
    expect(screen.getByText('BOOST')).toBeInTheDocument();
  });

  it('does not invent mining values when the backend snapshot is unavailable', () => {
    render(<PlanetMiningOverlay />);
    expect(screen.getByText('Mining unavailable')).toBeInTheDocument();
    expect(screen.queryByText('+0%')).not.toBeInTheDocument();
  });

  it('does not render a per-Planet mined total that would double count wallet balance', () => {
    render(<PlanetMiningOverlay mining={mining} />);

    expect(screen.queryByText('MINED')).not.toBeInTheDocument();
    expect(screen.queryByRole('tooltip', { name: 'Total minerals collected' })).not.toBeInTheDocument();
  });

  it('supports a compact card treatment for mining metrics', () => {
    render(<PlanetMiningOverlay mining={mining} variant="compact" />);
    const overlay = screen.getByTestId('planet-mining-overlay');
    expect(overlay).toHaveClass('inset-x-2', 'bottom-2');
    expect(overlay.querySelector(':scope > div')).toHaveClass('p-2');
    expect(screen.getByText('RATE')).toBeInTheDocument();
    expect(screen.getByText('BOOST')).toBeInTheDocument();
    expect(screen.getByText('25.2')).toHaveClass('text-sm', 'text-[var(--rare)]');
  });
});
