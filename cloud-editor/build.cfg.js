import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
let { name, version } = JSON.parse(fs.readFileSync(join(__dirname, './package.json')).toString());

export const buildCfg = [
  {
    name,
    version,
    in: './index.js',
    out: './build/index.min.js',
    minify: true,
    minifyHtml: true,
    includeExternals: true,
  },
  {
    name,
    version,
    in: './index.js',
    out: './build/index.js',
    minify: false,
    minifyHtml: false,
    includeExternals: false,
  },
  {
    in: './src/css/index.css',
    out: './build/index.css',
    minify: false,
  },
  {
    in: './src/css/index.css',
    out: './build/index.min.css',
    minify: true,
  },
];
