/**
 * Regenerates `specs/public-api/public-surface.json` from the **published** documentation.
 *
 *   node scripts/extract-public-surface.mjs
 *
 * The docs live in a separate repo (`fern-docs`) that CI does not have, so the contract is transcribed into this
 * repo and asserted by the parity specs next to it. The source is uploadcare.com/docs rather than a local checkout:
 * a docs branch for an unreleased version describes API that has not shipped, and generating from one files the whole
 * of it as drift. That happened once — `navigate()` was reported as a missing public method when it was simply
 * unreleased.
 *
 * Fern's registry API (`registry.buildwithfern.com/v2/registry/docs/load-with-url`) needs an auth token, so this uses
 * the public surface Fern already exposes for machine readers: `llms.txt` indexes every page and maps it to a clean
 * Markdown version of itself.
 *
 * `knownMissing` and `knownMismatch` are carried over from the existing file — they record deliberate decisions, not
 * anything derivable from the docs.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DOCS_INDEX = 'https://uploadcare.com/docs/llms.txt';
const target = resolve(dirname(fileURLToPath(import.meta.url)), '../specs/public-api/public-surface.json');

const fetchText = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${url}`);
  }
  return response.text();
};

/**
 * Resolves a page by its documentation slug through the index, so a page that moves fails loudly here instead of
 * silently returning a 404 body.
 */
const pageLoader = async () => {
  const index = await fetchText(DOCS_INDEX);
  const urls = [...index.matchAll(/\((https:\/\/[^)]+\.md)\)/g)].map((match) => match[1]);

  return async (slug) => {
    const url = urls.find((candidate) => candidate.endsWith(`/docs/${slug}.md`));
    if (!url) {
      throw new Error(`"${slug}" is not listed in ${DOCS_INDEX}. Has the page moved?`);
    }
    return fetchText(url);
  };
};

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

const extractOptions = (markdown) => {
  const options = {};
  for (const block of markdown.split(/^### /m).slice(1)) {
    // Headings read `### pubkey \[#pubkey]`, so the name ends at the first space or bracket.
    const name = block.slice(0, block.search(/[\s[\\]/));
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

const extractMethods = (markdown) =>
  markdown
    .split(/^## /m)
    .slice(1)
    .map((block) => /^`([a-zA-Z]+)\(([^)]*)\)/m.exec(block))
    .filter(Boolean)
    .map((match) => ({ name: match[1], signature: match[0].replaceAll('`', '') }));

const loadPage = await pageLoader();
const [optionsMd, eventsMd, apiMd, stylingMd] = await Promise.all(
  ['file-uploader/options', 'file-uploader/events', 'file-uploader/api', 'file-uploader/styling'].map(loadPage),
);

const previous = JSON.parse(readFileSync(target, 'utf8'));

const surface = {
  ...previous,
  options: extractOptions(optionsMd),
  events: [...eventsMd.matchAll(/^### ([a-z-]+)$/gm)].map((match) => match[1]),
  methods: extractMethods(apiMd),
  cssVars: [...new Set([...stylingMd.matchAll(/--uc-[a-z0-9-]+/g)].map((match) => match[0]))].sort(),
};

writeFileSync(target, `${JSON.stringify(surface, null, 2)}\n`);
console.log(
  `options ${Object.keys(surface.options).length} | events ${surface.events.length} |`,
  `methods ${surface.methods.length} | cssVars ${surface.cssVars.length}`,
);
