// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RevealCompleteScreen } from './ExpeditionSuccessScreens';

describe('Expedition success screens', () => {
  afterEach(cleanup);

  it('renders server-generated Planet cards without a mint or claim action', () => {
    render(
      <RevealCompleteScreen
        cards={<div><article>Planet card A</article><article>Planet card B</article></div>}
        drawingId={218n}
        onExploreAgain={vi.fn()}
        onViewPlanets={vi.fn()}
      />,
    );

    expect(screen.getByText('PLANETS READY')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Your planets are ready.' })).toBeInTheDocument();
    expect(screen.getByText('Drawing #218')).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Mint' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Claim' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Explore again' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'My planets' })).toBeInTheDocument();
  });
});
