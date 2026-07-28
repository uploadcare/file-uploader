import { type CdnOperation, parseFileUrl, parseOperations, serializeCdnUrl } from '@uploadcare/cdn-url';

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && !!value;

/** Strip a leading `-/` or `/` and a trailing `/` from one loose fragment. */
const trimDelimiters = (fragment: string): string => {
  let str = fragment.trim();
  if (str.startsWith('-/')) {
    str = str.slice(2);
  } else if (str.startsWith('/')) {
    str = str.slice(1);
  }
  return str.endsWith('/') ? str.slice(0, -1) : str;
};

/**
 * Turn loose modifier fragments into structured operations. Config values and DOM
 * attributes arrive as strings — `'resize/100x'`, `'-/sharp/10/'`, or a whole
 * chain like `'format/auto/-/progressive/yes'` — and this is the single place
 * where they become `CdnOperation[]`.
 *
 * Non-string and empty fragments are dropped, so callers can pass a possibly-null
 * config value straight through without guarding it.
 *
 * @throws TypeError when a fragment is not a valid operation chain.
 */
export const operationsFromModifiers = (...fragments: unknown[]): CdnOperation[] => {
  const joined = fragments.filter(isNonEmptyString).map(trimDelimiters).filter(Boolean).join('/-/');
  // `parseOperations` requires the leading `-/` that trimming removed.
  return joined ? parseOperations(`-/${joined}/`) : [];
};

/**
 * Append operations after any the URL already carries, preserving addressing,
 * filename and conversion path.
 *
 * @throws TypeError when `url` is not a single-file CDN URL.
 */
export const withOperations = (url: string, operations: readonly CdnOperation[]): string => {
  const parsed = parseFileUrl(url);
  return serializeCdnUrl({ ...parsed, operations: [...parsed.operations, ...operations] });
};
