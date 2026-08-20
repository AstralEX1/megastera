// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlanetUpgradeAction } from './PlanetUpgradeAction';

const nextUpgrade = { targetLevel: 2, bonusBpsAfter: 2500, costMicros: '300000' };

describe('PlanetUpgradeAction', () => {
  afterEach(cleanup);

  it('renders the enabled next-level action and sends only its target level', () => {
    const onUpgrade = vi.fn();
    render(
      <PlanetUpgradeAction
        upgradesEnabled
        upgradeLevel={1}
        nextUpgrade={nextUpgrade}
        currentBalanceMicros="5000000"
        isPending={false}
        onUpgrade={onUpgrade}
      />,
    );

    expect(screen.getByText('Level L1')).toBeInTheDocument();
    expect(screen.getByText('Next upgrade: L2')).toBeInTheDocument();
    expect(screen.getByText('0.3 minerals')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Upgrade to L2' }));
    expect(onUpgrade).toHaveBeenCalledWith(2);
  });

  it('disables the action when the authoritative balance is insufficient', () => {
    render(
      <PlanetUpgradeAction
        upgradesEnabled
        upgradeLevel={1}
        nextUpgrade={nextUpgrade}
        currentBalanceMicros="299999"
        isPending={false}
        onUpgrade={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Upgrade to L2' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Insufficient balance');
  });

  it('keeps disabled, error, and max states explicit and accessible', () => {
    const { rerender } = render(
      <PlanetUpgradeAction
        upgradesEnabled
        upgradeLevel={1}
        nextUpgrade={nextUpgrade}
        currentBalanceMicros="5000000"
        isPending
        onUpgrade={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Upgrade to L2' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Upgrade to L2' })).toHaveTextContent('Upgrading');

    rerender(
      <PlanetUpgradeAction
        upgradesEnabled
        upgradeLevel={1}
        nextUpgrade={nextUpgrade}
        currentBalanceMicros="5000000"
        isPending={false}
        error={new Error('Upgrade failed.')}
        onUpgrade={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Upgrade failed.');

    rerender(
      <PlanetUpgradeAction
        upgradesEnabled
        upgradeLevel={3}
        nextUpgrade={null}
        currentBalanceMicros="5000000"
        isPending={false}
        onUpgrade={vi.fn()}
      />,
    );
    expect(screen.getByText('Maximum level reached.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('does not expose upgrade actions while the feature flag is off', () => {
    render(
      <PlanetUpgradeAction
        upgradesEnabled={false}
        upgradeLevel={0}
        nextUpgrade={nextUpgrade}
        currentBalanceMicros="5000000"
        isPending={false}
        onUpgrade={vi.fn()}
      />,
    );

    expect(screen.getByText('Upgrades are disabled.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
