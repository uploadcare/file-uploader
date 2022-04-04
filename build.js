import esbuild from 'esbuild';
import fs from 'fs';
import path, { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { buildItems } from './build-items.js';

let __dirname = dirname(fileURLToPath(import.meta.url));
let packageRootPath = __dirname;

let { name: packageName, version: packageVersion } = JSON.parse(
  fs.readFileSync(join(packageRootPath, './package.json')).toString()
);

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

function generateEnvFile(variables) {
  let template = fs.readFileSync(path.join(__dirname, './env.template.js')).toString();
  template = template.replaceAll(/{{(.+?)}}/g, (match, p1) => {
    return variables[p1];
  });
  fs.writeFileSync(path.join(packageRootPath, './env.js'), template);
}

function build(buildItem, watch) {
  esbuild
    .build({
      watch: watch && {
        onRebuild(error, result) {
          if (error) console.error(`${name}: watch build failed: `, error);
          else console.log(`${name}: watch build succeeded: `, result);
        },
      },
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

generateEnvFile({ packageVersion, packageName });

for (let buildItem of buildItems) {
  build(buildItem);
}
