import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
let { name, version } = JSON.parse(fs.readFileSync(join(__dirname, './package.json')).toString());

export const buildCfg = [
  {
    name,
    version,
    in: './regular/index.js',
    out: './build/regular/index.min.js',
    minify: true,
    minifyHtml: true,
  },
  {
    in: './regular/index.css',
    out: './build/regular/index.css',
    minify: false,
  },
  {
    in: './regular/index.css',
    out: './build/regular/index.min.css',
    minify: true,
  },
];
