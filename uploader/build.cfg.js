import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
let { name } = JSON.parse(fs.readFileSync(join(__dirname, './package.json')).toString());

export const uploader_build_cfg = [
  {
    name,
    in: './uploader/regular/index.js',
    out: './uploader/build/regular/uc-uploader.min.js',
    minifyHtml: true,
  },
  {
    in: './uploader/regular/index.css',
    out: './uploader/build/regular/uc-uploader.css',
  },
];

export const uploader_build_cfg_ROLLUP = {
  input: './uploader/regular/index.js',
  output: [
    {
      file: './uploader/build/regular/uc-uploader.jsdoc.js',
      format: 'esm',
    },
  ],
};
