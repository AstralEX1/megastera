// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useJackpotState } from '@/hooks/useJackpotState';
import { LandingLiveJackpot } from './LandingLiveJackpot';

vi.mock('@/hooks/useJackpotState', () => ({
  useJackpotState: vi.fn(),
}));

const mockedUseJackpotState = vi.mocked(useJackpotState);

describe('LandingLiveJackpot', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2_000_000_000 * 1_000));
    mockedUseJackpotState.mockReturnValue({
      phase: 'open',
      drawingId: 88n,
      state: {
        prizePool: 123_456_789n,
        drawingTime: 2_000_003_661n,
      } as never,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as ReturnType<typeof useJackpotState>);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the live jackpot and countdown without phase or drawing-number clutter', () => {
    render(<LandingLiveJackpot />);

    const jackpot = screen.getByTestId('landing-jackpot-echo');
    expect(jackpot).toHaveTextContent('$123.46');
    expect(jackpot.querySelectorAll('.depth-text__layer')).toHaveLength(64);
    expect(screen.getByTestId('landing-jackpot-layout')).toHaveClass('landing-live-jackpot-layout');
    const drawing = screen.getByTestId('landing-drawing-in');
    expect(drawing).toBeInTheDocument();
    expect(screen.getByText('LIVE JACKPOT').parentElement).toContainElement(drawing);
    expect(drawing.querySelector('.landing-live-jackpot-countdown-line')).toHaveTextContent(
      'DRAWING IN01:01:01',
    );
    expect(screen.getByText('LIVE JACKPOT')).toBeInTheDocument();
    expect(screen.getByText('DRAWING IN')).toBeInTheDocument();
    expect(screen.queryByText('TICKETS OPEN')).not.toBeInTheDocument();
    expect(screen.queryByText('DRAWING #88')).not.toBeInTheDocument();
    expect(screen.getByRole('timer')).toHaveTextContent('01:01:01');

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(screen.getByRole('timer')).toHaveTextContent('01:01:00');
  });
});
