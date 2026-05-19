import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'tsup';
import pkgJson from '../package.json' with { type: 'json' };

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const TSCONFIG = resolve(ROOT, 'tsconfig.json');

function banner(): string {
  const licenseUrl = new URL('blob/main/LICENSE', pkgJson.repository.url).toString();
  return [
    '/**',
    ' * @license',
    ` * Package: ${pkgJson.name}@${pkgJson.version} (${pkgJson.license})`,
    ` * License: ${licenseUrl}`,
    ` * Built: ${new Date().toISOString()}`,
    ' */',
  ].join('\n');
}

// dist: ESM library, deps externalised (consumer resolves @uploadcare/file-uploader)
await build({
  tsconfig: TSCONFIG,
  entry: { index: resolve(ROOT, 'src/index.ts') },
  outDir: resolve(ROOT, 'dist'),
  target: 'esnext',
  format: 'esm',
  banner: { js: banner() },
  dts: true,
  minify: false,
  splitting: false,
  treeshake: true,
  skipNodeModulesBundle: true,
  shims: false,
  esbuildOptions(options) {
    options.conditions = ['browser'];
    options.platform = 'browser';
    options.legalComments = 'linked';
  },
});

// web: standalone bundle, all deps inlined, minified, mangled.
// Alias `@uploadcare/file-uploader/internal` to its SOURCE file so esbuild
// can tree-shake at the module level instead of inlining all of
// file-uploader's pre-bundled dist/internal.js.
const FILE_UPLOADER_INTERNAL_SRC = resolve(ROOT, '../file-uploader/src/internal.ts');

await build({
  tsconfig: TSCONFIG,
  entry: { 'uc-cloud-image-editor.min': resolve(ROOT, 'src/index.ts') },
  outDir: resolve(ROOT, 'web'),
  target: 'esnext',
  format: 'esm',
  banner: { js: banner(), css: banner() },
  dts: false,
  minify: true,
  splitting: false,
  treeshake: true,
  noExternal: [/.*/],
  shims: false,
  esbuildOptions(options) {
    options.conditions = ['browser'];
    options.platform = 'browser';
    options.legalComments = 'linked';
    options.mangleProps = /^_/;
    options.alias = {
      ...(options.alias ?? {}),
      '@uploadcare/file-uploader/internal': FILE_UPLOADER_INTERNAL_SRC,
    };
  },
});
