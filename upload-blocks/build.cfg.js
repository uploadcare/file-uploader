import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
let { name } = JSON.parse(fs.readFileSync(join(__dirname, './package.json')).toString());

export const buildCfg = [
  {
    name,
    in: './index.js',
    out: './build/index.min.js',
    minify: true,
    minifyHtml: true,
  },
  {
    name,
    in: './index.js',
    out: './build/index.js',
    minify: false,
    minifyHtml: false,
  },
  {
    in: './themes/uc-basic/index.css',
    out: './build/index.css',
    minify: false,
  },
  {
    in: './themes/uc-basic/index.css',
    out: './build/index.min.css',
    minify: true,
  },
];
