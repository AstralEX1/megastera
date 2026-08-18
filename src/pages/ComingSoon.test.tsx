// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ComingSoon } from './ComingSoon';

afterEach(cleanup);

describe('ComingSoon roadmap', () => {
  it('presents the roadmap milestones and highlights the next update', () => {
    const { container } = render(<ComingSoon />);

    expect(screen.getByRole('heading', { name: 'Roadmap' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Genesis' })).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Mid-Season 1 Update' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Season 1 Finale' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Stellar Expansion' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Galactic Conflict' })).toBeInTheDocument();

    expect(screen.getByText('Minerals Become an In-Game Currency')).toBeInTheDocument();
    expect(screen.getByText('Planet Upgrades')).toBeInTheDocument();
    expect(screen.getByText('Mineral Rewards Based on Ticket Results')).toBeInTheDocument();
    expect(container.querySelector('[data-roadmap-current="true"]')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-roadmap-completed-item="true"]')).toHaveLength(3);
  });

  it('keeps future utility and PvP scope visible without over-specifying mechanics', () => {
    const { container } = render(<ComingSoon />);

    expect(screen.getByText('Stars as a New Game Asset')).toBeInTheDocument();
    expect(screen.getByText('Stellar Systems')).toBeInTheDocument();
    expect(screen.getByText('New Gameplay Mechanics')).toBeInTheDocument();
    expect(screen.getByText(/Season 1 assets will carry forward into Season 2/i)).toBeInTheDocument();

    expect(screen.getByText('PvP Gameplay')).toBeInTheDocument();
    expect(screen.getByText('Attack and Defend Stellar Systems')).toBeInTheDocument();
    expect(screen.getByText('Starships')).toBeInTheDocument();
    expect(screen.getByText('Captains')).toBeInTheDocument();
    expect(screen.getByText('Fleet-Based Mechanics')).toBeInTheDocument();
    expect(screen.getByText('Expanded Gameplay Built Around Player Competition')).toBeInTheDocument();

    expect(container.querySelector('svg')).not.toBeInTheDocument();
  });
});
