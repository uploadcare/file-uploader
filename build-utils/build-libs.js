import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { nodeExternalsPlugin } from 'esbuild-node-externals';

function jsBanner() {
  const license = fs.readFileSync('./LICENSE').toString();
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

function build(buildItem) {
  esbuild
    .build({
      entryPoints: [buildItem.in],
      format: 'esm',
      bundle: true,
      minify: buildItem.minify,
      sourcemap: false,
      outfile: buildItem.out,
      target: 'es2019',
      banner: {
        js: jsBanner(),
      },
      define: {
        __VERSION__: JSON.stringify(buildItem.version),
        __PACKAGE_NAME__: JSON.stringify(buildItem.name),
      },
      plugins: [!buildItem.includeExternals && nodeExternalsPlugin()].filter(Boolean),
    })
    .then(async () => {
      if (!buildItem.minifyHtml) {
        return;
      }
      let js = fs.readFileSync(buildItem.out).toString();
      let checkIfHtml = (str) => {
        return str.includes('<') && (str.includes('</') || str.includes('/>'));
      };
      let processChunk = (ch) => {
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
      let result = js
        .split('`')
        .map((chunk) => processChunk(chunk))
        .join('`')
        .split(`'`)
        .map((chunk) => processChunk(chunk))
        .join(`'`);
      fs.writeFileSync(buildItem.out, result);
    });
}

const args = process.argv.slice(2);
const buildConfigPath = path.join(process.cwd(), args[0]);

import(buildConfigPath).then((module) => {
  const buildConfig = module.buildCfg;
  for (let item of buildConfig) {
    build(item);
  }
});
