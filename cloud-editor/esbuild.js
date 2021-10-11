import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

let version = JSON.parse(fs.readFileSync('./package.json').toString()).version;
let locales = fs.readdirSync('./src/l10n/locales/').map((file) => path.basename(file, '.json'));

let buildSequence = [
  {
    in: './src/index.js',
    out: 'dist/uploadcare-editor.js',
    minifyHtml: true,
  },
];

function build(buildItem) {
  return esbuild
    .build({
      entryPoints: [buildItem.in],
      bundle: true,
      minify: true,
      sourcemap: false,
      outfile: buildItem.out,
      define: {
        __DEPLOY_ENV__: JSON.stringify('production'),
        __DEBUG__: JSON.stringify(Boolean(false)),
        __VERSION__: JSON.stringify(version),
        __LOCALES__: JSON.stringify(locales),
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
          // return htmlMin.split('" ').join('"').split('; ').join(';').split(': ').join(':').trim();
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

Promise.allSettled(buildSequence.map((buildItem) => build(buildItem))).then((results) => {
  if (results.filter(({ status }) => status === 'rejected').length > 0) {
    process.exit(1);
  }
});
