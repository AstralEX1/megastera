// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TicketStatus } from '@/lib/ticketStatus';
import { PlanetTicketAction } from './PlanetTicketAction';

const payout = 12_500_000n;

describe('PlanetTicketAction', () => {
  afterEach(cleanup);

  it.each([
    [{ kind: 'countdown', time: '01:02:03' }, 'Drawing in 01:02:03'],
    [{ kind: 'drawing' }, 'Drawing…'],
    [{ kind: 'claimed', amount: payout }, 'Claimed $12.50 USDC'],
    [{ kind: 'drawn' }, 'Drawn'],
    [{ kind: 'unavailable' }, 'Unavailable'],
  ] as const)('renders %s without a claim button', (status, label) => {
    render(<PlanetTicketAction status={status as TicketStatus} />);

    expect(screen.getByTestId(`ticket-status-${status.kind}`)).toHaveTextContent(label);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders a claim button with the payout and forwards the click', () => {
    const onClaim = vi.fn();
    render(
      <PlanetTicketAction
        status={{ kind: 'claimable', amount: payout, ticketId: 456n }}
        onClaim={onClaim}
      />,
    );

    const button = screen.getByRole('button', { name: 'Claim $12.50 USDC' });
    fireEvent.click(button);

    expect(onClaim).toHaveBeenCalledOnce();
  });

  it('disables the claim action while the existing claim hook is pending', () => {
    render(
      <PlanetTicketAction
        status={{ kind: 'claimable', amount: payout, ticketId: 456n }}
        isClaimPending
      />,
    );

    expect(screen.getByRole('button', { name: 'Claiming…' })).toBeDisabled();
  });
});
