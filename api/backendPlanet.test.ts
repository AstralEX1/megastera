import { describe, expect, it } from 'vitest';
import { getAddress, stringToHex, type Hex } from 'viem';
import { BASE_SEPOLIA_CHAIN_ID, MEGAPLANETS_SOURCE } from './config';
import { BASE_SEPOLIA_JACKPOT, type MegasteraProof } from './eligibility';
import { MemoryBackendPlanetStore, deriveBackendPlanet } from './backendPlanet';

const proof: MegasteraProof = {
  recipient: getAddress('0x1111111111111111111111111111111111111111'),
  ticketId: 456n,
  drawingId: 12n,
  normals: [3, 17, 42, 88, 201],
  bonusBall: 9,
  originTxHash: `0x${'ab'.repeat(32)}` as Hex,
  blockNumber: 44_996_800n,
  logIndex: 4n,
  blockHash: `0x${'cd'.repeat(32)}` as Hex,
  purchasedAt: new Date('2026-08-13T12:00:00.000Z'),
  chainId: BASE_SEPOLIA_CHAIN_ID,
  jackpotAddress: BASE_SEPOLIA_JACKPOT,
  source: stringToHex(MEGAPLANETS_SOURCE, { size: 32 }),
};

describe('backend Planet generation', () => {
  it('derives deterministic traits and GIF bytes for a fixed proof', () => {
    const now = new Date('2026-08-13T12:30:00.000Z');
    const first = deriveBackendPlanet(proof, now);
    const second = deriveBackendPlanet(proof, now);

    expect(first.seed).toBe(second.seed);
    expect(first.traitsHash).toBe(second.traitsHash);
    expect(first.gifHash).toBe(second.gifHash);
    expect(first.gifData).toEqual(second.gifData);
    expect(first.gifData.slice(0, 6)).toEqual(new TextEncoder().encode('GIF89a'));
    expect(first.baseMineralsPerDay).toMatch(/^\d+$/);
  });

  it('is idempotent and scopes list results to the receipt recipient', async () => {
    const store = new MemoryBackendPlanetStore();
    const first = await store.generatePlanet(proof);
    const second = await store.generatePlanet(proof);
    const other = await store.generatePlanet({
      ...proof,
      ticketId: 457n,
      originTxHash: `0x${'ef'.repeat(32)}` as Hex,
      recipient: getAddress('0x2222222222222222222222222222222222222222'),
    });

    expect(second.planetId).toBe(first.planetId);
    expect(second.gifHash).toBe(first.gifHash);
    expect(other.planetId).not.toBe(first.planetId);
    expect((await store.listPlanets(proof.recipient)).map((planet) => planet.ticketId)).toEqual(['456']);
    expect(await store.getPlanet(first.planetId)).toMatchObject({ ticketId: '456', status: 'READY' });

    const gif = await store.getGif(first.planetId);
    expect(gif?.hash).toBe(first.gifHash);
    expect(gif?.bytes).toEqual(expect.any(Uint8Array));
  });
});
