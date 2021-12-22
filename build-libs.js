import esbuild from 'esbuild';
import fs from 'fs';

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

let { version: uploadBlocksVersion } = JSON.parse(fs.readFileSync('./upload-blocks/package.json').toString());

const buildSequence = [
  {
    version: uploadBlocksVersion,
    in: './upload-blocks/index.js',
    out: './upload-blocks/build/upload-blocks.js',
    minifyHtml: false,
  },
  {
    version: uploadBlocksVersion,
    in: './upload-blocks/DefaultWidget/DefaultWidget.js',
    out: './upload-blocks/build/default-widget.js',
    minifyHtml: false,
  },
  {
    in: './upload-blocks/themes/uc-basic/index.css',
    out: './upload-blocks/build/uc-basic.css',
  },
  {
    in: './re-assets/js/live.js',
    out: './build/site-live-html.js',
    minifyHtml: true,
  },
];

function build(buildItem) {
  esbuild
    .build({
      entryPoints: [buildItem.in],
      format: 'esm',
      bundle: true,
      minify: true,
      sourcemap: false,
      outfile: buildItem.out,
      target: 'es2019',
      banner: {
        js: jsBanner(),
      },
      define: {
        __VERSION__: JSON.stringify(buildItem.version),
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

buildSequence.forEach((buildItem) => {
  build(buildItem);
});
