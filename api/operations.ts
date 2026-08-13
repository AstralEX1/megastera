export type OperationalSnapshot = {
  role: 'api';
  startedAt: string;
  requestsTotal: number;
  errorsTotal: number;
};

export type OperationalState = {
  recordHttpRequest: (status: number) => void;
  snapshot: () => OperationalSnapshot;
  reset: () => void;
};

export function createOperationalState(options: { now?: () => number } = {}): OperationalState {
  const now = options.now ?? Date.now;
  const startedAt = new Date(now()).toISOString();
  let requestsTotal = 0;
  let errorsTotal = 0;

  return {
    recordHttpRequest(status) {
      requestsTotal += 1;
      if (status >= 500) errorsTotal += 1;
    },
    snapshot() {
      return { role: 'api', startedAt, requestsTotal, errorsTotal };
    },
    reset() {
      requestsTotal = 0;
      errorsTotal = 0;
    },
  };
}
