import { build as viteBuild } from 'vite';
import dts from 'vite-plugin-dts';

import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dependencies } from '../package.json'

import { type BuildItem, srcPath, buildItems } from './build-items';
import { unlayeredCss } from './vite-plugins/unlayered-css';
import { banner } from './banner';

const __dirname = dirname(fileURLToPath(import.meta.url));

const ROOT_DIR = resolve(__dirname, '..');
const TSCONFIG_PATH = resolve(ROOT_DIR, 'tsconfig.app.json');

const externalDeps = Object.keys(dependencies ?? {});

function normalizeEntry(entry: BuildItem['entry']): Record<string, string> {
  if (Array.isArray(entry)) {
    const result: Record<string, string> = {};
    for (const entryPath of entry) {
      const rel = relative(srcPath('.'), entryPath);
      const name = rel.replace(/\.tsx?$/, '');
      result[name] = entryPath;
    }
    return result;
  }
  if (typeof entry === 'string') {
    const rel = relative(srcPath('.'), entry);
    const name = rel.replace(/\.tsx?$/, '');
    return { [name]: entry };
  }
  return entry as Record<string, string>;
}

async function build(buildItem: BuildItem) {
  const entry = normalizeEntry(buildItem.entry);
  const isLibBuild = !buildItem.bundleExternalDependencies;

  const plugins = [
    dts({
      insertTypesEntry: true,
      tsconfigPath: TSCONFIG_PATH,
      entryRoot: srcPath('.'),
      outDir: buildItem.outDir,
    }),
    unlayeredCss(buildItem),
  ];

  await viteBuild({
    configFile: false,
    plugins,
    build: {
      outDir: buildItem.outDir,
      emptyOutDir: false,
      lib: {
        formats: [buildItem.format === 'iife' ? 'iife' : 'es'],
        entry,
        fileName: (_, entry) => entry + '.js',
        cssFileName: (buildItem.cssFilename ?? 'index.css').replace(/\.css$/, ''),
        ...(buildItem.format === 'iife' && { name: 'UC' }),
      },
      rolldownOptions: {
        treeshake: true,
        output: {
          banner: banner()
        },
        external: isLibBuild
          ? (id: string) => externalDeps.some((dep) => id === dep || id.startsWith(dep + '/'))
          : [],
      },
    },
  });
}

for (const buildItem of buildItems) {
  await build(buildItem);
}
