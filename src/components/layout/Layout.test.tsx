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

  it('renders the global footer with external links only', () => {
    render(
      <Layout active="play" onSelect={vi.fn()}>
        <p>Page content</p>
      </Layout>,
    );

    expect(screen.getByText('Page content')).toBeInTheDocument();
    const footer = screen.getByRole('contentinfo');

    expect(footer).toBeInTheDocument();
    expect(footer).not.toHaveTextContent(/Participating assets may be lost/i);
    expect(screen.queryByRole('link', { name: 'full disclaimer' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'X Megastera' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Megapot Docs' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Megapot site' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Support' })).toBeInTheDocument();
  });

  it('renders an uppercase text-only brand in the shell', () => {
    render(
      <Layout active="play" onSelect={vi.fn()}>
        <p>Page content</p>
      </Layout>,
    );

    const brandLink = screen.getByRole('link', { name: 'MEGASTERA' });
    expect(brandLink).toHaveTextContent('MEGASTERA');
    expect(brandLink.querySelector('svg')).not.toBeInTheDocument();
  });

  it('gives Play a wider centered shell with mobile bottom clearance', () => {
    render(
      <Layout active="play" onSelect={vi.fn()}>
        <p>Page content</p>
      </Layout>,
    );

    const main = screen.getByRole('main');
    expect(main).toHaveClass('max-w-[1440px]');
    expect(main).toHaveClass('pb-[calc(env(safe-area-inset-bottom)+5rem)]');
  });
});
