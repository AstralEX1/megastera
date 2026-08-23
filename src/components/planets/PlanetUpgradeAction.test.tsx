// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlanetUpgradeAction } from './PlanetUpgradeAction';

const nextUpgrade = { targetLevel: 2, bonusBpsAfter: 2500, costMicros: '300000' };

describe('PlanetUpgradeAction', () => {
  afterEach(cleanup);

  it('renders the enabled upgrade action and sends only its target level', () => {
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

    expect(screen.getByText('Upgrades')).toBeInTheDocument();
    expect(screen.getByText('+10%')).toBeInTheDocument();
    expect(screen.getByText('+25%')).toBeInTheDocument();
    expect(screen.getByText('+50%')).toBeInTheDocument();
    expect(screen.getByText('0.3 minerals')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Upgrade · 0.3 minerals' }));
    expect(onUpgrade).toHaveBeenCalledWith(2);
  });

  it('renders a filled accessible 1-2-3 progression and a white costed primary action', () => {
    render(
      <PlanetUpgradeAction
        upgradesEnabled
        upgradeLevel={1}
        nextUpgrade={nextUpgrade}
        currentBalanceMicros="5000000"
        isPending={false}
        onUpgrade={vi.fn()}
      />,
    );

    const progression = screen.getByTestId('upgrade-progression');
    expect(progression).toHaveAttribute('role', 'progressbar');
    expect(progression).toHaveAttribute('aria-valuenow', '1');
    expect(progression).toHaveAttribute('aria-valuetext', 'Level 1 of Level 3');
    expect(within(screen.getByTestId('upgrade-level-1')).getByText('1')).toBeInTheDocument();
    expect(within(screen.getByTestId('upgrade-level-2')).getByText('2')).toBeInTheDocument();
    expect(within(screen.getByTestId('upgrade-level-3')).getByText('3')).toBeInTheDocument();
    expect(screen.getByTestId('upgrade-level-1')).toHaveAttribute('data-state', 'current');
    expect(screen.getByTestId('upgrade-level-2')).toHaveAttribute('data-state', 'next');
    expect(screen.getByTestId('upgrade-level-3')).toHaveAttribute('data-state', 'locked');
    expect(screen.getByTestId('upgrade-level-1')).toHaveTextContent(/^1$/);
    expect(screen.getByTestId('upgrade-level-2')).toHaveTextContent(/^2$/);
    expect(screen.getByTestId('upgrade-level-3')).toHaveTextContent(/^3$/);

    const button = screen.getByRole('button', { name: 'Upgrade · 0.3 minerals' });
    expect(button).toHaveClass('bg-white', 'text-black');
    expect(button).toHaveTextContent('0.3 minerals');
    expect(screen.queryByText('Complete')).not.toBeInTheDocument();
    expect(screen.queryByText('Current')).not.toBeInTheDocument();
    expect(screen.queryByText('Next')).not.toBeInTheDocument();
    expect(screen.queryByText('Locked')).not.toBeInTheDocument();
    expect(screen.getByRole('tooltip', {
      name: 'Upgrade to Level 2 · +25% bonus · Cost: 0.3 minerals',
    })).toBeInTheDocument();
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

    expect(screen.getByRole('button', { name: 'Upgrade · 0.3 minerals' })).toBeDisabled();
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
    expect(screen.getByRole('button', { name: 'Upgrade · 0.3 minerals' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Upgrade · 0.3 minerals' })).toHaveTextContent(
      'Upgrading',
    );

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

  it('fills exactly the three upgrade segments at the maximum level', () => {
    render(
      <PlanetUpgradeAction
        upgradesEnabled
        upgradeLevel={3}
        nextUpgrade={null}
        currentBalanceMicros="5000000"
        isPending={false}
        onUpgrade={vi.fn()}
      />,
    );

    const progression = screen.getByTestId('upgrade-progression');
    expect(progression.querySelectorAll('[data-testid^="upgrade-level-"]')).toHaveLength(3);
    for (const level of [1, 2, 3]) {
      expect(screen.getByTestId(`upgrade-level-${level}`)).toHaveAttribute(
        'data-state',
        level === 3 ? 'current' : 'complete',
      );
      expect(screen.getByTestId(`upgrade-level-${level}`)).toHaveClass('bg-[var(--rare)]');
    }
    expect(screen.getByText('Maximum level reached.')).toBeInTheDocument();
  });
});
