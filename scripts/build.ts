import fs from 'node:fs';
import path, { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postcssCascadeLayers from '@csstools/postcss-cascade-layers';
import { type Plugin as EsbuildPlugin, build as esbuild } from 'esbuild';
import { minifyTemplates, writeFiles } from 'esbuild-minify-templates';
import postcss from 'postcss';
import { build as tsupBuild } from 'tsup';
import pkgJson from '../package.json';
import { type BuildItem, buildItems } from './build-items';

const __dirname = dirname(fileURLToPath(import.meta.url));

const ROOT_DIR = path.resolve(__dirname, '..');
const TSCONFIG_PATH = path.resolve(ROOT_DIR, 'tsconfig.app.json');

function banner() {
  const repositoryUrl = pkgJson.repository.url;
  const licenseUrl = new URL('blob/main/LICENSE', repositoryUrl).toString();
  const licenseName = pkgJson.license;
  const pkgName = pkgJson.name;
  const version = pkgJson.version;
  const buildTime = new Date().toISOString();

  return [
    '/**',
    ' * @license',
    ` * Package: ${pkgName}@${version} (${licenseName})`,
    ` * License: ${licenseUrl}`,
    ` * Built: ${buildTime}`,
    ' */',
  ].join('\n');
}

/** Fails the build if the bundle's module graph contains one of `patterns`. */
const forbidModules = (patterns: RegExp[]): EsbuildPlugin => ({
  name: 'forbid-modules',
  setup(build) {
    build.onEnd((result) => {
      const inputs = result.metafile?.inputs ?? {};
      for (const pattern of patterns) {
        const found = Object.keys(inputs).find((input) => pattern.test(input));
        if (found) {
          // Walk back to the entry along the first importer of each module, so the error shows how it got in.
          const chain = [found];
          for (let current = found; ; ) {
            const importer = Object.keys(inputs).find(
              (input) => !chain.includes(input) && inputs[input]?.imports.some((imported) => imported.path === current),
            );
            if (!importer) break;
            chain.push(importer);
            current = importer;
          }
          throw new Error(
            `The bundle must not contain ${found} (${pattern}). Import chain: ${chain.reverse().join(' -> ')}`,
          );
        }
      }
    });
  },
});

// No dependency or native object has a `$<base36>` property name (`RegExp.$1`-`$9` are only on the constructor).
const RESERVED_MANGLE_PREFIX = '$';

/**
 * Maps every `_` name the build will mangle to a reserved `$<base36>` name, collected by a probe build of the same
 * entries. Rebuilt on every build: a stale cache would leave new names to esbuild, which picks its own short ones.
 */
async function reservedMangleCache(buildItem: BuildItem): Promise<Record<string, string>> {
  const probe = await esbuild({
    entryPoints: buildItem.entry,
    outdir: buildItem.outDir,
    bundle: true,
    write: false,
    packages: 'external',
    tsconfig: TSCONFIG_PATH,
    conditions: ['browser', 'production'],
    mainFields: ['exports', 'module', 'main'],
    platform: 'browser',
    format: buildItem.format,
    loader: { '.css': 'empty' },
    logLevel: 'silent',
    mangleProps: /^_/,
    mangleCache: {},
  });
  return Object.fromEntries(
    Object.keys(probe.mangleCache ?? {}).map((name, i) => [name, `${RESERVED_MANGLE_PREFIX}${i.toString(36)}`]),
  );
}

/**
 * Native property names, which esbuild must not hand out as mangled names. It avoids every name the bundle's own
 * source uses as a property, but knows nothing of the ones only native objects carry: Lit's `_$litType$` became `at`
 * once, and Lit took every array a template rendered (`Array.prototype.at`) for a template result and threw.
 */
const nativePropertyNames = (): Record<string, false> =>
  Object.fromEntries(
    [Object, Array, Function, String, Number, Boolean, Symbol, Promise, Map, Set, WeakMap, WeakSet, RegExp, Date, Error]
      .flatMap((type) => [...Object.getOwnPropertyNames(type), ...Object.getOwnPropertyNames(type.prototype)])
      .map((name) => [name, false]),
  );

/**
 * Fails the build if esbuild mangled a name the probe missed, i.e. gave it a short name of its own. Checked against the
 * reserved names themselves, not their prefix: esbuild's own short names can start with `$` too.
 */
const requireReservedMangle = (reserved: Record<string, string>): EsbuildPlugin => ({
  name: 'require-reserved-mangle',
  setup(build) {
    build.onEnd((result) => {
      const unreserved = Object.entries(result.mangleCache ?? {}).filter(
        ([name, mangled]) => typeof mangled === 'string' && mangled !== reserved[name],
      );
      if (unreserved.length > 0) {
        throw new Error(`Mangled outside the reserved names: ${unreserved.map(([name]) => name).join(', ')}`);
      }
    });
  },
});

async function build(buildItem: BuildItem) {
  const mangleCache = buildItem.mangleProps === 'reserved' ? await reservedMangleCache(buildItem) : undefined;
  await tsupBuild({
    tsconfig: TSCONFIG_PATH,
    outExtension: () => ({ js: '.js', dts: '.d.ts' }),
    entry: buildItem.entry,
    outDir: buildItem.outDir,
    target: 'esnext',
    minify: buildItem.minify,
    terserOptions: { compress: { passes: 2 } },
    banner: {
      js: banner(),
      css: banner(),
    },
    format: buildItem.format,
    skipNodeModulesBundle: true,
    esbuildOptions(options) {
      // `production` pins the prod build of deps that ship both (dev builds carry
      // extra dev-time warnings). Without it, resolution only lands on prod by
      // falling through to the bare `import`/`default` entry — correct today, but
      // it depends on a dep's `exports` key order rather than on our intent, and
      // any dep declaring `development` before a bare fallback would hand us the
      // dev build. Vite still resolves `development` when serving, so `npm run dev`
      // keeps the friendlier builds.
      options.conditions = ['browser', 'production'];
      // `exports` first (modern packages resolve via conditions), then the
      // classic `module`/`main` fallback for deps that ship no `exports` map —
      // e.g. `signal-polyfill` (ESM, `main`-only), pulled in via `SignalMap`.
      // Packages that DO declare `exports` are unaffected (esbuild ignores
      // mainFields when an `exports` condition matches).
      options.mainFields = ['exports', 'module', 'main'];
      options.platform = 'browser';
      // tsup turns esbuild's minifier off for `'terser'`; it stays on, so terser starts from esbuild's output.
      options.minify = Boolean(buildItem.minify);
      options.legalComments = 'linked';
      options.logOverride = { 'ignored-bare-import': 'silent' };
      if (buildItem.mangleProps) {
        options.mangleProps = /^_/;
        // The reserved names all share a prefix no native property has.
        options.mangleCache = mangleCache ?? nativePropertyNames();
      }
      if (buildItem.forbiddenModules) {
        options.metafile = true;
      }
    },
    esbuildPlugins: [
      ...(buildItem.minify ? [minifyTemplates(), writeFiles()] : []),
      ...(buildItem.forbiddenModules ? [forbidModules(buildItem.forbiddenModules)] : []),
      ...(mangleCache ? [requireReservedMangle(mangleCache)] : []),
    ],
    noExternal: buildItem.bundleExternalDependencies ? [/.*/] : undefined,
    globalName: buildItem.format === 'iife' ? 'UC' : undefined,
    splitting: false,
    treeshake: true,
    shims: false,
    // `stripInternal` drops `@internal` members: `mangleProps` renames `_`-prefixed ones, so a published type for
    // them would compile and read `undefined`.
    dts: { compilerOptions: { stripInternal: true } },
    env: {
      NODE_ENV: 'production',
    },
    plugins: [
      {
        name: 'rename-output',
        async buildEnd(ctx) {
          if (buildItem.cssFilename) {
            const cssFiles = ctx.writtenFiles.map((f) => f.name).filter((name) => name.endsWith('.css'));
            if (cssFiles.length > 1) {
              throw new Error('Multiple CSS files generated, cannot rename.');
            }
            await fs.promises.rename(cssFiles[0], join(buildItem.outDir, buildItem.cssFilename));
          }
        },
      },
      {
        name: 'unlayered-css',
        async buildEnd(ctx) {
          for (const file of ctx.writtenFiles) {
            if (!file.name.endsWith('.css')) {
              continue;
            }
            const absPath = buildItem.cssFilename
              ? join(buildItem.outDir, buildItem.cssFilename)
              : path.resolve(file.name);
            const fileDir = path.dirname(absPath);
            const baseName = path.basename(absPath);
            const [namePart, ...restParts] = baseName.split('.');
            const layeredName = [`${namePart}.layered`, ...restParts].join('.');
            const layeredPath = path.join(fileDir, layeredName);
            await fs.promises.copyFile(absPath, layeredPath);
            const cssContent = await fs.promises.readFile(absPath, 'utf-8');
            const processed = await postcss([postcssCascadeLayers()]).process(cssContent, {
              from: file.name,
              to: file.name,
            });
            await fs.promises.writeFile(absPath, processed.css);
          }
        },
      },
    ],
  });
}

for (const buildItem of buildItems) {
  await build(buildItem);
}
