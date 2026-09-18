import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

/**
 * Compiles a two-line consumer of the published types under the compiler settings integrators actually use. tsd covers
 * one configuration; this covers module resolution and strictness flags tsd does not vary. The consumer lives inside
 * the repo so `@uploadcare/file-uploader` resolves through the package's own `exports` (Node self-reference), exactly
 * as it does for an installed copy.
 */

const here = dirname(fileURLToPath(import.meta.url));
const consumerDir = join(here, '.types-matrix');
const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc');

const CONSUMER = `
import type { Config, OutputFileEntry, UploaderPlugin } from '@uploadcare/file-uploader';
import '@uploadcare/file-uploader/types/jsx';
export declare const config: Config;
export declare const entry: OutputFileEntry;
export declare const plugin: UploaderPlugin;
`;

const STRICT = ['--strict', '--exactOptionalPropertyTypes', '--noUncheckedIndexedAccess', '--skipLibCheck', 'false'];

type Case = { name: string; file: string; flags: string[] };
const cases: Case[] = [
  { name: 'bundler', file: 'consumer.ts', flags: ['--module', 'esnext', '--moduleResolution', 'bundler'] },
  { name: 'nodenext (ESM)', file: 'consumer.mts', flags: ['--module', 'nodenext', '--moduleResolution', 'nodenext'] },
  { name: 'node16 (CJS)', file: 'consumer.cts', flags: ['--module', 'node16', '--moduleResolution', 'node16'] },
];

const compile = ({ file, flags }: Case): { ok: boolean; output: string } => {
  mkdirSync(consumerDir, { recursive: true });
  const path = join(consumerDir, file);
  writeFileSync(path, CONSUMER);
  try {
    execFileSync(
      process.execPath,
      [
        tsc,
        '--noEmit',
        '--target',
        'es2022',
        '--lib',
        'es2022,dom,dom.iterable',
        '--jsx',
        'react',
        ...STRICT,
        ...flags,
        path,
      ],
      {
        stdio: 'pipe',
      },
    );
    return { ok: true, output: '' };
  } catch (error) {
    return { ok: false, output: String((error as { stdout?: Buffer }).stdout ?? error) };
  }
};

afterAll(() => {
  rmSync(consumerDir, { recursive: true, force: true });
});

describe('published types under consumer compiler settings', () => {
  it('bundler, strict, skipLibCheck: false', () => {
    const { ok, output } = compile(cases[0]);
    expect(output).toBe('');
    expect(ok).toBe(true);
  });

  // QUIRK(types): under node16 / nodenext resolution with `skipLibCheck: false`, type-checking fails inside
  // `dist/index.d.ts`: `TelemetryManager` (src/abstract/managers/TelemetryManager.ts:15) derives its method types
  // from `TelemetryRequest`, so the import of `@uploadcare/quality-insights` ends up in the public d.ts, and that
  // package ships extensionless relative imports in an ESM d.ts, which those resolutions reject. Goes away when the
  // dependency fixes its d.ts or the manager stops leaking the type. Pinned as current behaviour, not endorsed.
  it.each(cases.slice(1))('$name, strict, skipLibCheck: false fails inside quality-insights', (c) => {
    const { ok, output } = compile(c);
    expect(ok).toBe(false);
    expect(output).toContain('quality-insights');
  });
});
