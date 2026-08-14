// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./MobileWalletBar', () => ({ MobileWalletBar: () => null }));
vi.mock('./ProfileCard', () => ({ ProfileCard: () => null }));
vi.mock('./Nav', () => ({
  Nav: () => null,
  MobileBottomNav: () => null,
}));

import { Layout } from './Layout';

describe('Layout', () => {
  afterEach(cleanup);

  it('does not render the global disclaimer footer', () => {
    render(<Layout active="play" onSelect={vi.fn()}><p>Page content</p></Layout>);

    expect(screen.getByText('Page content')).toBeInTheDocument();
    expect(screen.queryByText(/Participating assets may be lost/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /full disclaimer/i })).not.toBeInTheDocument();
  });

  it('renders an uppercase text-only brand in the shell', () => {
    render(<Layout active="play" onSelect={vi.fn()}><p>Page content</p></Layout>);

    const brandLink = screen.getByRole('link', { name: 'MEGASTERA' });
    expect(brandLink).toHaveTextContent('MEGASTERA');
    expect(brandLink.querySelector('svg')).not.toBeInTheDocument();
  });
});
