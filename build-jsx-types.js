import fs from 'fs';
import path from 'path';

// TODO: build JSX types
const DIST_PATH = './dist';
const INDEX_DTS_PATH = path.join(DIST_PATH, 'index.d.ts');
const SOURCE_TAGS_DTS_PATH = './types/tags.d.ts';
const DIST_TAGS_DTS_PATH = path.join(DIST_PATH, 'tags.d.ts');
const JSX_TYPES_HEADER = `/// <reference path="${path.relative(DIST_PATH, DIST_TAGS_DTS_PATH)}" />\n`;

fs.copyFileSync(SOURCE_TAGS_DTS_PATH, DIST_TAGS_DTS_PATH);

let indexDTS = fs.readFileSync(INDEX_DTS_PATH).toString();
if (!indexDTS.startsWith(JSX_TYPES_HEADER)) {
  indexDTS = JSX_TYPES_HEADER + indexDTS;
}
fs.writeFileSync(INDEX_DTS_PATH, indexDTS);
