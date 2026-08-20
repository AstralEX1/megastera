import { describe, expect, it } from 'vitest';
import { getApiBaseUrlEnvironmentMismatch, resolveApiBaseUrl } from './api';

describe('Megapot Data API network selection', () => {
  it('defaults Base Sepolia reads to the testnet host', () => {
    expect(resolveApiBaseUrl('testnet')).toBe('https://api-testnet.megapot.io/v1');
  });

  it('fails closed when a Base Mainnet host is configured for testnet', () => {
    expect(resolveApiBaseUrl('testnet', 'https://api.megapot.io/v1')).toBe('https://api-testnet.megapot.io/v1');
    expect(getApiBaseUrlEnvironmentMismatch('testnet', 'https://api.megapot.io/v1')).toMatch(/Base Mainnet/);
  });

  it('keeps same-origin proxies available for environment-specific routing', () => {
    expect(resolveApiBaseUrl('testnet', '/api/megapot')).toBe('/api/megapot');
    expect(getApiBaseUrlEnvironmentMismatch('testnet', '/api/megapot')).toBeUndefined();
  });
});
