import { describe, expect, it } from 'vitest';
import { createOperationalState } from './operations';

describe('operational API state', () => {
  it('tracks HTTP requests without indexer metrics', () => {
    const state = createOperationalState({ now: () => 1_700_000_000_000 });
    state.recordHttpRequest(200);
    state.recordHttpRequest(503);
    expect(state.snapshot()).toEqual({
      role: 'api',
      startedAt: '2023-11-14T22:13:20.000Z',
      requestsTotal: 2,
      errorsTotal: 1,
    });
  });
});
