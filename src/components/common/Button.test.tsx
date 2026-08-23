// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('uses contained primary and outlined secondary hierarchy with restrained rounding', () => {
    render(
      <>
        <Button size="sm">Primary</Button>
        <Button variant="secondary">Secondary</Button>
      </>,
    );

    expect(screen.getByRole('button', { name: 'Primary' })).toHaveClass(
      'rounded-md',
      'shadow-sm',
    );
    expect(screen.getByRole('button', { name: 'Secondary' })).toHaveClass(
      'bg-transparent',
      'border',
    );
  });
});
