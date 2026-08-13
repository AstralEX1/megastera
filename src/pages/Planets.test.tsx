// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  account: { address: '0x0000000000000000000000000000000000000001', isConnected: true },
  planets: [] as unknown[],
}));

vi.mock('wagmi', () => ({ useAccount: () => mocks.account }));
vi.mock('@/hooks/useBackendPlanets', () => ({
  useBackendPlanets: () => ({ data: mocks.planets, isLoading: false, isError: false, refetch: vi.fn() }),
}));
vi.mock('@/hooks/useWalletMining', () => ({ useWalletMining: () => ({ data: { planets: [] } }) }));

import { Planets } from './Planets';

const backendPlanet = {
  planetId: 'planet-1', chainId: 84532, ticketId: '456', ownerAddress: mocks.account.address,
  name: 'Astraea', seed: `0x${'11'.repeat(32)}`, traitsHash: `0x${'22'.repeat(32)}`,
  generatorVersion: 3, planetType: 'Nebula', terrain: 'simplex', rarity: 'Common',
  satelliteCount: 1, hasRing: false, baseMineralsPerDay: '24', generatedAt: '2026-08-13T12:00:00.000Z',
  status: 'READY', gifHash: `0x${'33'.repeat(32)}`, gifUrl: '/api/planets/planet-1/gif',
  ticket: { ticketId: '456', drawingId: '12', normals: [3, 17, 42, 88, 201], bonusBall: 9, originTxHash: `0x${'ab'.repeat(32)}`, logIndex: '4' },
};

describe('backend My Planets', () => {
  afterEach(() => { cleanup(); mocks.planets = []; });

  it('shows the empty state without NFT controls', () => {
    render(<Planets onNavigate={vi.fn()} onViewPlanet={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'No planets yet' })).toBeInTheDocument();
    expect(screen.queryByText(/Mint|Reveal|NFT BaseScan/)).not.toBeInTheDocument();
  });

  it('renders backend GIF and traits from the API record', () => {
    mocks.planets = [backendPlanet];
    render(<Planets onNavigate={vi.fn()} onViewPlanet={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'My Planets' })).toBeInTheDocument();
    expect(screen.getByAltText('Astraea animated planet')).toHaveAttribute('src', '/api/planets/planet-1/gif');
    expect(screen.getByText('Nebula')).toBeInTheDocument();
    expect(screen.queryByText(/Mint|Reveal|NFT BaseScan/)).not.toBeInTheDocument();
  });
});
