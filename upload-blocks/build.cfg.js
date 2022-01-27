import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
let { name, version } = JSON.parse(fs.readFileSync(join(__dirname, './package.json')).toString());

export const upload_blocks_build_cfg = [
  {
    name,
    in: './upload-blocks/index.js',
    out: './upload-blocks/build/upload-blocks.min.js',
    minifyHtml: true,
  },
  {
    in: './upload-blocks/themes/uc-basic/index.css',
    out: './upload-blocks/build/uc-basic.css',
  },
];

export const upload_blocks_build_cfg_ROLLUP = {
  input: './upload-blocks/index.js',
  output: [
    {
      file: './upload-blocks/build/upload-blocks.jsdoc.js',
      format: 'esm',
    },
  ],
};
