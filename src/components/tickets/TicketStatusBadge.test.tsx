// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TicketStatusBadge } from './TicketStatusBadge';

describe('TicketStatusBadge', () => {
  afterEach(cleanup);

  it('renders the status vocabulary with a compact payout for wins', () => {
    render(
      <TicketStatusBadge
        status={{ kind: 'claimable', amount: 1250000n, ticketId: 42n }}
      />,
    );

    expect(screen.getByTestId('ticket-status-claimable')).toHaveTextContent('Claimable');
    expect(screen.getByTestId('ticket-status-claimable')).toHaveTextContent('$1.25');
  });
});
