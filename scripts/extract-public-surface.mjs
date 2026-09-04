/**
 * Regenerates `specs/public-api/public-surface.json` from the docs.
 *
 * The documented public API lives in a separate repo (`fern-docs`), which CI does not have, so the contract is
 * transcribed into this repo and asserted by the parity specs next to it. Run this after the docs change:
 *
 *   node scripts/extract-public-surface.mjs ~/workspace/fern-docs
 *
 * `knownMissing` and `knownMismatch` are carried over from the existing file — they record deliberate decisions, not
 * anything derivable from the docs.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const docsRoot = resolve(process.argv[2] ?? `${process.env.HOME}/workspace/fern-docs`, 'fern/pages/file-uploader');
const target = resolve(dirname(fileURLToPath(import.meta.url)), '../specs/public-api/public-surface.json');

const read = (file) => readFileSync(resolve(docsRoot, file), 'utf8');

/** Documented defaults look like `` `0` ``, `` `''` `` or ``  `0` - means no limit ``. */
const parseDefault = (text) => {
  if (!text) return { documented: null };
  const match = /^`([^`]*)`/.exec(text.trim());
  if (!match) return { documented: text.trim() };
  const literal = match[1];
  const entry = { documented: literal };
  if (literal === 'true') entry.value = true;
  else if (literal === 'false') entry.value = false;
  else if (literal === 'null') entry.value = null;
  else if (/^-?\d+$/.test(literal)) entry.value = Number(literal);
  else if (/^(''|"")$/.test(literal)) entry.value = '';
  else if (literal.startsWith("'") && literal.endsWith("'")) entry.value = literal.slice(1, -1);
  return entry;
};

const extractOptions = () => {
  const options = {};
  for (const block of read('options.mdx').split(/^### /m).slice(1)) {
    const name = block.slice(0, block.search(/[\s[]/));
    if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(name)) continue;
    const field = (label) => new RegExp(`^${label}: (.*)$`, 'm').exec(block)?.[1].trim() ?? null;
    const attribute = field('Attribute')?.replaceAll('`', '') ?? null;
    options[name] = {
      // `-` in the docs means the option is settable as a JS property only.
      attribute: attribute === '-' ? null : attribute,
      type: field('Type')?.replaceAll('`', '') ?? null,
      ...parseDefault(field('Default')),
    };
  }
  return options;
};

const extractMethods = () =>
  read('api.mdx')
    .split(/^## /m)
    .slice(1)
    .map((block) => /^`([a-zA-Z]+)\(([^)]*)\)/m.exec(block))
    .filter(Boolean)
    .map((match) => ({ name: match[1], signature: match[0].replaceAll('`', '') }));

const previous = JSON.parse(readFileSync(target, 'utf8'));

const surface = {
  ...previous,
  options: extractOptions(),
  events: [...read('events.mdx').matchAll(/^### ([a-z-]+)$/gm)].map((match) => match[1]),
  methods: extractMethods(),
  cssVars: [...new Set([...read('styling.mdx').matchAll(/--uc-[a-z0-9-]+/g)].map((match) => match[0]))].sort(),
};

writeFileSync(target, `${JSON.stringify(surface, null, 2)}\n`);
console.log(
  `options ${Object.keys(surface.options).length} | events ${surface.events.length} |`,
  `methods ${surface.methods.length} | cssVars ${surface.cssVars.length}`,
);
