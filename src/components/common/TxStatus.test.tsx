// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TxStatus } from './TxStatus';

describe('TxStatus', () => {
  afterEach(cleanup);

  it('keeps generic copy for write and receipt errors', () => {
    render(<TxStatus hash={undefined} isPending={false} isSuccess={false} error={new Error('raw provider details')} />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Transaction failed — please try again.');
    expect(status).not.toHaveTextContent('raw provider details');
  });
});
