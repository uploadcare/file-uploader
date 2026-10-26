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

// A cold tsc over the shipped d.ts takes several seconds on CI, well past vitest's 5s default.
describe('published types under consumer compiler settings', { timeout: 60_000 }, () => {
  it('bundler, strict, skipLibCheck: false', () => {
    const { ok, output } = compile(cases[0]);
    expect(output).toBe('');
    expect(ok).toBe(true);
  });

  // QUIRK(types): the pinned alpha of @uploadcare/cdn-url ships extensionless relative imports in its ESM
  // declarations. NodeNext rejects those imports and cannot resolve the public CdnOperation/FilterName types.
  // Pin these diagnostics until the dependency fixes its declarations; unrelated type errors must still fail.
  it('nodenext (ESM), strict, skipLibCheck: false fails inside cdn-url', () => {
    const { ok, output } = compile(cases[1]);
    expect(ok).toBe(false);
    // The same four errors in any order: which import the bundled d.ts emits first follows its module graph.
    const lines = output.trim().split(/\r?\n/);
    expect(lines).toHaveLength(4);
    expect(lines).toEqual(
      expect.arrayContaining([
        expect.stringMatching(
          /^dist\/index\.d\.ts\(\d+,\d+\): error TS2305: Module '"@uploadcare\/cdn-url\/ops"' has no exported member 'FilterName'\.$/,
        ),
        expect.stringMatching(
          /^dist\/index\.d\.ts\(\d+,\d+\): error TS2305: Module '"@uploadcare\/cdn-url"' has no exported member 'CdnOperation'\.$/,
        ),
        ...['index', 'ops'].map(
          (entry) =>
            `node_modules/@uploadcare/cdn-url/dist/types/${entry}.d.ts(1,15): error TS2834: Relative import paths need explicit file extensions in ECMAScript imports when '--moduleResolution' is 'node16' or 'nodenext'. Consider adding an extension to the import path.`,
        ),
      ]),
    );
  });
});
