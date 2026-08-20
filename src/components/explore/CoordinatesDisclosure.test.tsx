// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CoordinatesPanel } from './CoordinatesDisclosure';

const baseProps = {
  bounds: { ballMax: 50, bonusballMax: 100 },
  tickets: [],
  onTicketsChange: vi.fn(),
};

describe('CoordinatesPanel', () => {
  afterEach(cleanup);
  it('renders one dynamic placeholder for each unconfigured ticket', () => {
    render(<CoordinatesPanel {...baseProps} quantity={3} />);

    expect(screen.getAllByTestId('dynamic-ticket')).toHaveLength(3);
    expect(screen.queryByText('Quick pick')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit ticket/i })).not.toBeInTheDocument();
  });

  it('keeps known coordinates and fills only the remaining dynamic slots', () => {
    render(
      <CoordinatesPanel
        {...baseProps}
        quantity={3}
        tickets={[{ normals: [1, 2, 3, 4, 5], bonusball: 6 }]}
      />,
    );

    expect(screen.getByRole('button', { name: 'Edit ticket 1' })).toBeInTheDocument();
    expect(screen.getAllByTestId('dynamic-ticket')).toHaveLength(2);
  });

  it('removes the obsolete quick-pick controls and copy', () => {
    render(<CoordinatesPanel {...baseProps} quantity={3} />);

    expect(screen.queryByRole('switch', { name: 'Automatic quick pick' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+ Add manual ticket' })).not.toBeInTheDocument();
    expect(screen.queryByText(/manually selected|automatic quick pick/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Quick picks are generated/i)).not.toBeInTheDocument();
  });

  it('does not offer remove actions for concrete ticket rows', () => {
    render(
      <CoordinatesPanel
        {...baseProps}
        quantity={1}
        tickets={[{ normals: [1, 2, 3, 4, 5], bonusball: 6 }]}
      />,
    );

    expect(screen.getByRole('button', { name: 'Edit ticket 1' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
  });

  it('opens the picker from a concrete row and saves the edited ticket at its index', async () => {
    const user = userEvent.setup();
    const onTicketsChange = vi.fn();
    render(
      <CoordinatesPanel
        {...baseProps}
        onTicketsChange={onTicketsChange}
        quantity={1}
        tickets={[{ normals: [1, 2, 3, 4, 5], bonusball: 6 }]}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Edit ticket 1' }));
    expect(screen.getByRole('dialog', { name: 'Pick your numbers' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '1, selected' }));
    await user.click(screen.getByRole('button', { name: '6, not selected' }));
    await user.click(screen.getByRole('button', { name: 'Bonus 7, not selected' }));
    await user.click(screen.getByRole('button', { name: 'Save ticket' }));

    expect(onTicketsChange).toHaveBeenCalledWith([{ normals: [2, 3, 4, 5, 6], bonusball: 7 }]);
  });

  it('shuffles the complete concrete prefix without changing quantity', async () => {
    const user = userEvent.setup();
    const onTicketsChange = vi.fn();
    render(
      <CoordinatesPanel
        {...baseProps}
        onTicketsChange={onTicketsChange}
        quantity={3}
        tickets={[{ normals: [1, 2, 3, 4, 5], bonusball: 6 }]}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Shuffle' }));

    expect(onTicketsChange).toHaveBeenCalledOnce();
    expect(onTicketsChange.mock.calls[0][0]).toHaveLength(3);
  });
});
