import esbuild from 'esbuild';
import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { buildItems } from './build-items.js';

let __dirname = dirname(fileURLToPath(import.meta.url));
let packageRootPath = __dirname;

function jsBanner() {
  let license = fs.readFileSync(path.join(packageRootPath, './LICENSE')).toString();
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

for (let buildItem of buildItems) {
  build(buildItem);
}
