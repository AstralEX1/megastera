import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repositoryRoot = fileURLToPath(new URL('.', import.meta.url));

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === 'generated') return [];

    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.isFile() && path.endsWith('.ts') ? [path] : [];
  });
}

function relativeImportSpecifiers(source: string): string[] {
  const specifiers = new Set<string>();
  const staticImportPattern = /^\s*(?:import|export)\b[^\n;]*?["'](\.{1,2}\/[^"']+)["']/gm;
  const dynamicImportPattern = /\bimport\s*\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/g;

  for (const pattern of [staticImportPattern, dynamicImportPattern]) {
    for (const match of source.matchAll(pattern)) {
      const specifier = match[1];
      if (specifier) specifiers.add(specifier);
    }
  }

  return [...specifiers].sort();
}

describe('Node ESM import specifiers', () => {
  it('uses explicit .js extensions in the Vercel API and generator source graph', () => {
    const files = [
      join(repositoryRoot, 'api/index.ts'),
      ...sourceFiles(join(repositoryRoot, 'server/api')),
      ...sourceFiles(join(repositoryRoot, 'packages/planet-generator/src')),
    ];
    const invalidImports = files.flatMap((file) =>
      relativeImportSpecifiers(readFileSync(file, 'utf8'))
        .filter((specifier) => !specifier.endsWith('.js'))
        .map((specifier) => `${file.replace(`${repositoryRoot}/`, '')}: ${specifier}`),
    );

    expect(invalidImports).toEqual([]);
  });
});
