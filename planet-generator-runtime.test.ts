import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repositoryRoot = fileURLToPath(new URL('./', import.meta.url));

describe('planet-generator Node runtime package', () => {
  it('resolves the package through its compiled Node entrypoint', () => {
    const output = execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        "import('@megaplanets/planet-generator').then((module) => console.log(typeof module.createPlanetConfig))",
      ],
      { cwd: repositoryRoot, encoding: 'utf8' },
    );

    expect(output.trim()).toBe('function');
  });
});
