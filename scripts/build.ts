import fs from 'node:fs';
import path, { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postcssCascadeLayers from '@csstools/postcss-cascade-layers';
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

async function build(buildItem: BuildItem) {
  await tsupBuild({
    tsconfig: TSCONFIG_PATH,
    outExtension: () => ({ js: '.js', dts: '.d.ts' }),
    entry: buildItem.entry,
    outDir: buildItem.outDir,
    target: 'esnext',
    minify: buildItem.minify,
    banner: {
      js: banner(),
      css: banner(),
    },
    format: buildItem.format,
    skipNodeModulesBundle: true,
    esbuildOptions(options) {
      options.conditions = ['browser'];
      options.mainFields = ['exports'];
      options.platform = 'browser';
      options.legalComments = 'linked';
      if (buildItem.mangleProps) {
        options.mangleProps = /^_/;
      }
    },
    esbuildPlugins: buildItem.minify ? [minifyTemplates(), writeFiles()] : [],
    noExternal: buildItem.bundleExternalDependencies ? [/.*/] : undefined,
    globalName: buildItem.format === 'iife' ? 'UC' : undefined,
    keepNames: buildItem.format === 'iife' ? true : undefined,
    splitting: false,
    treeshake: true,
    shims: false,
    dts: true,
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
