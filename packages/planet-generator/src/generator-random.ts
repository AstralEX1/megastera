import { assertBytes32 } from './input.js';
import { DeterministicRandom } from './random.js';
import type { Hex } from './visual-types.js';

/**
 * Callers use one named stream per trait subsystem so adding a trait cannot
 * alter any unrelated deterministic sequence.
 */
export function namedRandom(seed: Hex, namespace: string): DeterministicRandom {
  assertBytes32(seed, 'seed');
  return new DeterministicRandom(seed, `MEGAPLANETS_GENERATOR:${namespace}`);
}
