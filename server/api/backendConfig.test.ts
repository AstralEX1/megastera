import { describe, expect, it } from 'vitest';
import { loadBackendPlanetConfig, loadMineralEconomyConfig } from './backendConfig.js';

const baseEnv = {
  BASE_RPC_URL: 'https://rpc.example.test',
  DATABASE_URL: 'postgresql://example.test/db',
};

describe('Minerals Economy configuration', () => {
  it('leaves v2 disabled when the optional cutover is absent', () => {
    const config = loadBackendPlanetConfig(baseEnv);
    expect(config.mineralEconomyCutoverAt).toBeNull();
    expect(config.mineralUpgradesEnabled).toBe(false);
  });

  it('parses a cutover and opt-in upgrade flag without changing Planet requirements', () => {
    const config = loadMineralEconomyConfig({
      MINERAL_ECONOMY_CUTOVER_AT: '2026-08-20T00:00:00.000Z',
      MINERAL_UPGRADES_ENABLED: 'true',
    });
    expect(config.mineralEconomyCutoverAt?.toISOString()).toBe('2026-08-20T00:00:00.000Z');
    expect(config.mineralUpgradesEnabled).toBe(true);
  });

  it('rejects invalid optional values', () => {
    expect(() => loadMineralEconomyConfig({ MINERAL_ECONOMY_CUTOVER_AT: 'not-a-date' })).toThrow(
      'MINERAL_ECONOMY_CUTOVER_AT must be a valid timestamp',
    );
    expect(() => loadMineralEconomyConfig({ MINERAL_ECONOMY_CUTOVER_AT: '2026-08-20T00:00:00Z' })).toThrow(
      'MINERAL_ECONOMY_CUTOVER_AT must be an exact UTC midnight timestamp',
    );
    expect(() => loadMineralEconomyConfig({ MINERAL_ECONOMY_CUTOVER_AT: '2026-02-30T00:00:00.000Z' })).toThrow(
      'MINERAL_ECONOMY_CUTOVER_AT must be a valid timestamp',
    );
    expect(() => loadMineralEconomyConfig({ MINERAL_UPGRADES_ENABLED: 'sometimes' })).toThrow(
      'MINERAL_UPGRADES_ENABLED must be a boolean',
    );
  });

  it('requires exact HTTPS SIWE configuration before upgrades can be enabled', () => {
    const config = loadBackendPlanetConfig({
      ...baseEnv,
      MINERAL_UPGRADES_ENABLED: 'true',
      SIWE_ORIGIN: 'https://megastera.example',
      SIWE_SESSION_SECRET: 's'.repeat(32),
    });

    expect(config.siweOrigin).toBe('https://megastera.example');
    expect(config.siweSessionSecret).toBe('s'.repeat(32));
  });

  it('fails closed on missing or malformed SIWE configuration', () => {
    expect(() => loadBackendPlanetConfig({
      ...baseEnv,
      MINERAL_UPGRADES_ENABLED: 'true',
    })).toThrow('SIWE_ORIGIN is required');
    expect(() => loadBackendPlanetConfig({
      ...baseEnv,
      MINERAL_UPGRADES_ENABLED: 'true',
      SIWE_ORIGIN: 'http://megastera.example',
      SIWE_SESSION_SECRET: 's'.repeat(32),
    })).toThrow('SIWE_ORIGIN must be an exact HTTPS origin');
    expect(() => loadBackendPlanetConfig({
      ...baseEnv,
      MINERAL_UPGRADES_ENABLED: 'true',
      SIWE_ORIGIN: 'https://megastera.example/path',
      SIWE_SESSION_SECRET: 's'.repeat(32),
    })).toThrow('SIWE_ORIGIN must be an exact HTTPS origin');
    expect(() => loadBackendPlanetConfig({
      ...baseEnv,
      MINERAL_UPGRADES_ENABLED: 'true',
      SIWE_ORIGIN: 'https://megastera.example',
      SIWE_SESSION_SECRET: 'too-short',
    })).toThrow('SIWE_SESSION_SECRET must contain at least 32 bytes');
  });
});
