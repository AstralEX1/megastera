import { deserializePlanetInput, serializePlanetInput } from './input.js';
import { verifyPlanetDescriptor } from './integrity.js';
import type { PlanetConfig, PlanetDescriptor, SerializedPlanetInput } from './types.js';

export type SerializedPlanetDescriptor = Omit<PlanetDescriptor, 'input'> & {
  input: SerializedPlanetInput;
};

export function serializePlanetDescriptor(
  descriptor: PlanetDescriptor,
): SerializedPlanetDescriptor {
  return { ...descriptor, input: serializePlanetInput(descriptor.input) };
}

export function deserializePlanetDescriptor(
  descriptor: SerializedPlanetDescriptor,
  config: PlanetConfig,
): PlanetDescriptor {
  return verifyPlanetDescriptor(
    { ...descriptor, input: deserializePlanetInput(descriptor.input) },
    config,
  );
}
