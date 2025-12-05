import fs from 'node:fs';
import path, { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postcssCascadeLayers from '@csstools/postcss-cascade-layers';
import postcss from 'postcss';
import { build as tsupBuild } from 'tsup';
import { dependencies } from '../package.json';
import { type BuildItem, buildItems } from './build-items';

const __dirname = dirname(fileURLToPath(import.meta.url));

const ROOT_DIR = path.resolve(__dirname, '..');
const LICENSE_PATH = path.resolve(ROOT_DIR, 'LICENSE');
const TSCONFIG_PATH = path.resolve(ROOT_DIR, 'tsconfig.app.json');

function jsBanner() {
  const license = fs.readFileSync(LICENSE_PATH).toString();
  return (
    '/**\n' +
    ' * @license\n' +
    license
      .split('\n')
      .map((line) => ` * ${line}`)
      .join('\n') +
    '\n */'
  );
}

function minifyHtmlTemplates(js: string): string {
  const checkIfHtml = (str: string) => {
    return str.includes('<') && (str.includes('</') || str.includes('/>'));
  };
  const processChunk = (ch: string) => {
    if (checkIfHtml(ch)) {
      let htmlMin = ch.split('\n').join(' ');
      while (htmlMin.includes('  ')) {
        htmlMin = htmlMin.split('  ').join(' ');
      }
      htmlMin = htmlMin.split('> <').join('><');
      return htmlMin.trim();
    }
    return ch;
  };
  const result = js
    .split('`')
    .map((chunk) => processChunk(chunk))
    .join('`')
    .split(`'`)
    .map((chunk) => processChunk(chunk))
    .join(`'`);

  return result;
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
      js: jsBanner(),
      css: jsBanner(),
    },
    format: buildItem.format,
    skipNodeModulesBundle: true,
    esbuildOptions(options) {
      options.conditions = ['browser'];
      options.mainFields = ['exports'];
      options.platform = 'browser';
      options.legalComments = 'linked';
    },
    noExternal: buildItem.bundleExternalDependencies ? Object.keys(dependencies) : undefined,
    globalName: buildItem.format === 'iife' ? 'UC' : undefined,
    keepNames: buildItem.format === 'iife' ? true : undefined,
    splitting: false,
    shims: false,
    dts: true,
    plugins: [
      {
        name: 'minify-html-templates',
        renderChunk(code) {
          return {
            code: buildItem.minify ? minifyHtmlTemplates(code) : code,
            map: null,
          };
        },
      },
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
