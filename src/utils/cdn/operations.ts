import { type CdnOperation, parseFileUrl, parseOperations, serializeFileUrl } from '@uploadcare/cdn-url';

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && !!value;

/**
 * Turn loose modifier fragments into structured operations. Config values and DOM
 * attributes arrive as strings — `'resize/100x'`, `'-/sharp/10/'`, or a whole
 * chain like `'format/auto/-/progressive/yes'` — and this is the single place
 * where they become `CdnOperation[]`. `parseOperations` tolerates all of those
 * loose shapes itself, so each fragment is parsed on its own and the results are
 * concatenated — no normalisation needed here.
 *
 * Non-string and empty fragments are dropped, so callers can pass a possibly-null
 * config value straight through without guarding it.
 *
 * @throws TypeError when a fragment is not a valid operation chain.
 */
export const operationsFromModifiers = (...fragments: unknown[]): CdnOperation[] =>
  fragments.filter(isNonEmptyString).flatMap(parseOperations);

/**
 * Append operations after any the URL already carries, preserving addressing,
 * filename and conversion path.
 *
 * @throws TypeError when `url` is not a single-file CDN URL.
 */
export const withOperations = (url: string, operations: readonly CdnOperation[]): string => {
  const parsed = parseFileUrl(url);
  return serializeFileUrl({ ...parsed, operations: [...parsed.operations, ...operations] });
};
