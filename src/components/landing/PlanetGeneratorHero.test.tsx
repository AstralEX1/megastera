// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlanetGeneratorHero } from './PlanetGeneratorHero';

vi.mock('@/components/planets/PlanetGif', () => ({
  PlanetGif: ({
    preview,
  }: {
    preview: { descriptor: { input: { ticketId: bigint } }; visualTraitsHash: string };
  }) => (
    <span data-testid="planet-gif-preview" data-visual-traits-hash={preview.visualTraitsHash}>
      Generated ticket {preview.descriptor.input.ticketId.toString()}
    </span>
  ),
}));

describe('PlanetGeneratorHero', () => {
  beforeEach(() => {
    const values = [100, 900_000];
    vi.stubGlobal('crypto', {
      getRandomValues: vi.fn((buffer: Uint32Array) => {
        buffer[0] = values.shift() ?? 42;
        return buffer;
      }),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('starts from a random ticket and generates a different Planet only on demand', () => {
    vi.useFakeTimers();
    const { container } = render(<PlanetGeneratorHero />);

    expect(screen.getByTestId('planet-gif-preview')).toHaveTextContent('Generated ticket 1100');
    const previewArticle = screen.getByRole('article', { name: 'Interactive Planet preview' });
    const initialVisualSeed = previewArticle.getAttribute('data-planet-visual-seed');
    const initialVisualTraitsHash = screen
      .getByTestId('planet-gif-preview')
      .getAttribute('data-visual-traits-hash');
    expect(initialVisualSeed).not.toBeNull();
    expect(initialVisualSeed ?? '').toMatch(/^0x[0-9a-f]{64}$/);
    expect(initialVisualTraitsHash).not.toBeNull();
    expect(initialVisualTraitsHash ?? '').toMatch(/^0x[0-9a-f]{64}$/);
    expect(container.querySelector('.landing-live-generator')).toBeInTheDocument();
    expect(container.querySelector('.landing-live-generator-topline')).not.toBeInTheDocument();
    expect(container.querySelector('.landing-live-generator-meta')).not.toBeInTheDocument();
    expect(
      container.querySelector('.landing-live-generator-art.landing-planet-card'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('PLANET = TICKET')).not.toBeInTheDocument();
    expect(screen.queryByText('MEGAPOT · IN DRAW')).not.toBeInTheDocument();

    const generatePlanetButton = screen.getByRole('button', { name: 'Tap' });
    expect(generatePlanetButton).not.toHaveTextContent('↗');
    expect(generatePlanetButton).not.toHaveAttribute('aria-label');
    expect(generatePlanetButton).not.toHaveAttribute('title');
    expect(generatePlanetButton.closest('.landing-live-generator-art')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Generate another/i })).not.toBeInTheDocument();

    fireEvent.click(generatePlanetButton);
    expect(screen.getByTestId('planet-gif-preview')).toHaveTextContent('Generated ticket 901000');
    expect(previewArticle.getAttribute('data-planet-visual-seed')).toMatch(/^0x[0-9a-f]{64}$/);
    expect(previewArticle.getAttribute('data-planet-visual-seed')).not.toBe(initialVisualSeed);
    expect(screen.getByTestId('planet-gif-preview').getAttribute('data-visual-traits-hash')).not.toBe(
      initialVisualTraitsHash,
    );

    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect(screen.getByTestId('planet-gif-preview')).toHaveTextContent('Generated ticket 901000');
  });
});
