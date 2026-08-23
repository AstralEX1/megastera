// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PlanetCardStack } from './PlanetCardStack';

describe('PlanetCardStack', () => {
  afterEach(cleanup);

  it('cycles real Planet cards and animates only the active asset', () => {
    render(<PlanetCardStack />);

    const carousel = screen.getByRole('region', { name: 'Planet discovery carousel' });
    expect(screen.getByText('DRAG PLANETS')).toBeInTheDocument();
    expect(carousel.querySelector('.landing-planet-stack-drag-visual')).toBeInTheDocument();
    const firstActiveImage = carousel.querySelector('[data-active="true"] img');
    expect(firstActiveImage).toHaveAttribute('src', expect.stringMatching(/\.gif$/));

    const firstName = carousel.querySelector('[data-active="true"] h3')?.textContent;
    fireEvent.click(screen.getByRole('button', { name: 'Show next Planet' }));

    const nextActive = carousel.querySelector('[data-active="true"]');
    expect(nextActive?.querySelector('h3')?.textContent).not.toBe(firstName);
    expect(nextActive?.querySelector('img')).toHaveAttribute(
      'src',
      expect.stringMatching(/\.gif$/),
    );
    expect(
      [...carousel.querySelectorAll('[data-active="false"] img')].every((image) =>
        image.getAttribute('src')?.endsWith('.png'),
      ),
    ).toBe(true);
  });
});
