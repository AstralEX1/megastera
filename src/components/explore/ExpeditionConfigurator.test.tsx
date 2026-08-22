// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExpeditionConfigurator } from './ExpeditionConfigurator';

describe('ExpeditionConfigurator', () => {
  afterEach(cleanup);

  const props = {
    quantity: 3,
    total: 3_000_000n,
    bounds: null,
    tickets: [],
    disabled: false,
    onQuantityChange: vi.fn(),
    onTicketsChange: vi.fn(),
    onExplore: vi.fn(),
  };

  it('renders the live jackpot as the depth headline', () => {
    const { container } = render(
      <ExpeditionConfigurator {...props} jackpotAmount={123_456_000n} />,
    );

    expect(screen.getByRole('heading', { name: 'Win up to $123.46' })).toBeInTheDocument();
    expect(container.querySelectorAll('.depth-text__layer')).toHaveLength(32);
    expect(container.querySelector('h1')).toHaveClass(
      'w-full',
      'min-w-0',
      'max-w-full',
      'overflow-hidden',
    );
    expect(container.querySelector('.depth-text')).toHaveStyle({
      '--depth-text-perspective': '1500px',
      '--depth-text-font-size': 'clamp(2rem, 7vw, 5.3rem)',
      '--depth-text-font-weight': '800',
      '--depth-text-face-color': '#f8fafc',
    });
    expect(container.querySelector('.depth-text')).toHaveClass('block', 'w-full', 'min-w-0');
    expect(container.querySelector('.depth-text__layer')).toHaveStyle({
      transform: 'translateZ(-128px)',
    });
  });

  it('shows a single selected planet in the static depth stack', () => {
    render(
      <ExpeditionConfigurator
        quantity={1}
        total={1_000_000n}
        bounds={null}
        tickets={[]}
        disabled={false}
        onQuantityChange={vi.fn()}
        onTicketsChange={vi.fn()}
        onExplore={vi.fn()}
      />,
    );

    expect(screen.getAllByRole('img', { name: /selected planet/i })).toHaveLength(1);
  });

  it('shows every selected planet in a static depth stack without carousel controls', () => {
    render(<ExpeditionConfigurator {...props} quantity={5} />);

    expect(
      screen.getByRole('group', { name: 'Selected planets visualization' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: /selected planet/i })).toHaveLength(5);
    expect(
      screen.queryByRole('button', { name: /previous slide|next slide/i }),
    ).not.toBeInTheDocument();
  });

  it('replaces the Explore copy with inline purchase progress', () => {
    render(<ExpeditionConfigurator {...props} exploreLabel="Confirming purchase…" disabled />);

    expect(screen.getByRole('heading', { name: 'Win up to $0' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirming purchase…' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /^Explore 3/ })).not.toBeInTheDocument();
  });

  it('shows an explicit loading state instead of a zero jackpot', () => {
    render(<ExpeditionConfigurator {...props} jackpotStatus="loading" />);

    expect(screen.getByRole('heading', { name: 'Loading jackpot…' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Loading drawing data…' })).toBeDisabled();
    expect(screen.queryByRole('heading', { name: 'Win up to $0' })).not.toBeInTheDocument();
  });

  it('offers a retry when drawing data is unavailable', async () => {
    const user = userEvent.setup();
    const onRetryJackpot = vi.fn();
    render(
      <ExpeditionConfigurator {...props} jackpotStatus="error" onRetryJackpot={onRetryJackpot} />,
    );

    expect(screen.getByRole('heading', { name: 'Jackpot unavailable' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Drawing data unavailable.');
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetryJackpot).toHaveBeenCalledOnce();
  });

  it('opens and closes coordinates from the desktop arrow', async () => {
    const user = userEvent.setup();
    render(
      <ExpeditionConfigurator
        quantity={3}
        total={3_000_000n}
        bounds={null}
        tickets={[]}
        disabled={false}
        onQuantityChange={vi.fn()}
        onTicketsChange={vi.fn()}
        onExplore={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Explore 3 · $3.00 USDC' })).toBeEnabled();

    expect(screen.getByTestId('expedition-core')).toHaveAttribute('data-layout-anchor', 'flow');
    expect(screen.getByTestId('expedition-core')).toHaveClass('max-w-[1120px]', 'min-w-0');
    expect(screen.getByTestId('coordinates-disclosure')).toHaveAttribute('data-side', 'in-flow');
    expect(screen.getByTestId('coordinates-disclosure')).toHaveAttribute('data-state', 'closed');
    expect(screen.getByTestId('coordinates-disclosure')).toHaveClass('max-h-0');

    const [toggle] = screen.getAllByRole('button', { name: 'Open coordinates' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveClass('w-full');
    expect(toggle).not.toHaveClass('fixed');
    expect(screen.getAllByRole('button', { name: 'Open coordinates' })).toHaveLength(1);
    expect(screen.getAllByText('Bonus Ball influences Planet generation.')).toHaveLength(1);

    await user.click(toggle);
    expect(screen.getAllByRole('region', { name: 'Coordinates' })).toHaveLength(1);
    expect(screen.getByTestId('coordinates-disclosure')).toHaveAttribute('data-state', 'open');
    expect(screen.getByTestId('coordinates-disclosure')).not.toHaveClass('max-h-0');

    const [closeToggle] = screen.getAllByRole('button', { name: 'Close coordinates' });
    await user.click(closeToggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('applies a Custom quantity after Enter', async () => {
    const user = userEvent.setup();
    const onQuantityChange = vi.fn();
    render(<ExpeditionConfigurator {...props} onQuantityChange={onQuantityChange} />);

    await user.click(screen.getByRole('button', { name: 'Custom quantity' }));
    await user.type(screen.getByLabelText('Custom planet count'), '42{enter}');

    expect(onQuantityChange).toHaveBeenLastCalledWith(42);
  });
});
