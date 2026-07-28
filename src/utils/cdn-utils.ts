import {
  type CdnOperation,
  type ParsedCdnUrl,
  parseCdnUrl,
  parseOperations,
  serializeCdnUrl,
  serializeOperations,
} from '@uploadcare/cdn-url';

/**
 * CDN URL helpers, backed by `@uploadcare/cdn-url`.
 *
 * The library parses a URL into a structure (`{ origin, uuid, operations,
 * filename }` for a file, `{ origin, operations, sourceUrl }` for a delivery
 * proxy) and serialises it back exactly, which replaces the string surgery this
 * module used to do. Two consequences worth knowing:
 *
 * - **It only understands complete CDN URLs.** A bare origin, or a URL whose
 *   first path segment is not a real UUID or group id, throws `TypeError`. The
 *   old helpers accepted those and returned best-effort garbage.
 * - **Errors travel.** These helpers no longer swallow malformed input; the
 *   callers that face user-supplied URLs (`<uc-img>` URL building, the editor's
 *   `updateImage`, `addFileFromCdnUrl`) catch and degrade.
 *
 * Structural parsing also retires a real bug: `trimFilename` used to strip the
 * filename with a substring `replace`, corrupting any path whose last segment
 * recurred earlier (`/a/a` → `//a`).
 */

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && !!value;

/** Group roots address a whole group, so they carry no operations. */
const operationsOf = (parsed: ParsedCdnUrl | null): CdnOperation[] =>
  parsed && parsed.kind !== 'group' ? parsed.operations : [];

const isRemoteSource = (filename: string): boolean => /^https?:\/\//i.test(filename);

const parseOrNull = (cdnUrl: string): ParsedCdnUrl | null => {
  try {
    return parseCdnUrl(cdnUrl);
  } catch {
    return null;
  }
};

/** Trim leading `-/`, `/` and trailing `/` from CDN operation */
export const normalizeCdnOperation = (operation?: unknown): string => {
  if (!isNonEmptyString(operation)) {
    return '';
  }
  let str = operation.trim();
  if (str.startsWith('-/')) {
    str = str.slice(2);
  } else if (str.startsWith('/')) {
    str = str.slice(1);
  }
  if (str.endsWith('/')) {
    str = str.slice(0, str.length - 1);
  }
  return str;
};

/**
 * Join multiple CDN operations into one string without trailing or leading delimeters
 */
export const joinCdnOperations = (...operations: unknown[]): string =>
  operations
    .filter(isNonEmptyString)
    .map((operation) => normalizeCdnOperation(operation))
    .filter(Boolean)
    .join('/-/');

/**
 * Parse loose operation fragments — a single `name/param` pair, or several joined
 * with `/-/` — into structured operations. Callers assemble modifiers as strings
 * (config values, `cdn-operations` attributes, the editor's serialised
 * transformations), so this is the seam where those become library operations.
 *
 * @throws TypeError when a fragment is not a valid operation chain.
 */
const operationsFromFragments = (...fragments: unknown[]): CdnOperation[] => {
  const joined = joinCdnOperations(...fragments);
  // `parseOperations` requires the leading `-/` that `joinCdnOperations` strips.
  return joined ? parseOperations(`-/${joined}/`) : [];
};

/**
 * Create string with leading `-/` from passed CDN operations. Do the same as `joinCdnOperations` but adds leading `-/`
 * and trailing `/`
 */
export const createCdnUrlModifiers = (...cdnOperations: unknown[]): string =>
  serializeOperations(operationsFromFragments(...cdnOperations));

/**
 * Extract filename, or the whole embedded source URL for a delivery-proxy URL.
 *
 * @throws TypeError when the input is not a CDN URL.
 */
export function extractFilename(cdnUrl: string): string {
  const parsed = parseCdnUrl(cdnUrl);
  if (parsed.kind === 'proxy') {
    return parsed.sourceUrl;
  }
  if (parsed.kind === 'group') {
    return '';
  }
  return parsed.filename ?? '';
}

/**
 * Extract UUID from CDN URL — the group's UUID for a group or group element, and
 * an empty string for a delivery-proxy URL, which addresses a remote source
 * rather than a stored file.
 *
 * @throws TypeError when the input is not a CDN URL.
 */
export function extractUuid(cdnUrl: string): string {
  const parsed = parseCdnUrl(cdnUrl);
  if (parsed.kind === 'file') {
    return parsed.uuid;
  }
  if (parsed.kind === 'proxy') {
    return '';
  }
  return parsed.group.uuid;
}

/**
 * Extract operations string from CDN URL, in its `-/…/` wire form.
 *
 * @throws TypeError when the input is not a CDN URL.
 */
export function extractCdnUrlModifiers(cdnUrl: string): string {
  return serializeOperations(operationsOf(parseCdnUrl(cdnUrl)));
}

/**
 * Extract operations from CDN URL as bare `name/param` strings.
 *
 * @throws TypeError when the input is not a CDN URL.
 */
export function extractOperations(cdnUrl: string): string[] {
  return operationsOf(parseCdnUrl(cdnUrl)).map((operation) => [operation.name, ...operation.params].join('/'));
}

/**
 * Drop the filename (or embedded source URL) and any query/hash, keeping origin,
 * addressing and operations.
 *
 * @throws TypeError when the input is not a CDN URL.
 */
export function trimFilename(cdnUrl: string): string {
  const parsed = parseCdnUrl(cdnUrl);
  if (parsed.kind === 'proxy') {
    // A proxy URL without its source is not addressable, so it cannot be
    // serialised structurally — origin plus operations is the trimmed form.
    return `${parsed.origin}/${serializeOperations(parsed.operations)}`;
  }
  // The query and hash belong to the full request (secure-delivery tokens live
  // there), so the trimmed base drops them — as the previous implementation did.
  if (parsed.kind === 'group') {
    return serializeCdnUrl({ ...parsed, search: '', hash: '' });
  }
  return serializeCdnUrl({ ...parsed, filename: null, search: '', hash: '' });
}

/**
 * Create a final CDN URL with CDN modifiers and filename. `cdnModifiers` are
 * appended after any operations already on `baseCdnUrl`, and `filename`
 * overrides the one carried by `baseCdnUrl` — an absolute `filename` means the
 * file is a remote source addressed through a delivery proxy.
 *
 * @throws TypeError when `baseCdnUrl` is not a CDN URL and no remote source is given.
 */
export const createCdnUrl = (baseCdnUrl: string, cdnModifiers?: string, filename?: string): string => {
  const added = cdnModifiers ? parseOperations(cdnModifiers) : [];

  if (filename && isRemoteSource(filename)) {
    // The base may be a bare proxy origin (`https://<pubkey>.ucr.io/`), which is
    // not itself a CDN URL — take its origin and let the source do the addressing.
    const parsedBase = parseOrNull(baseCdnUrl);
    return serializeCdnUrl({
      origin: parsedBase?.origin ?? new URL(baseCdnUrl).origin,
      sourceUrl: filename,
      operations: [...operationsOf(parsedBase), ...added],
    });
  }

  const parsed = parseCdnUrl(baseCdnUrl);
  if (parsed.kind === 'proxy') {
    return serializeCdnUrl({ ...parsed, operations: [...parsed.operations, ...added] });
  }
  if (parsed.kind === 'group') {
    // Group roots carry neither operations nor a filename.
    return serializeCdnUrl(parsed);
  }
  return serializeCdnUrl({
    ...parsed,
    operations: [...parsed.operations, ...added],
    filename: filename ?? parsed.filename,
  });
};

/**
 * Create URL for an original file on CDN — origin plus uuid, discarding any
 * operations, filename, query or hash the input carried.
 */
export const createOriginalUrl = (cdnUrl: string, uuid: string): string =>
  serializeCdnUrl({ origin: new URL(cdnUrl).origin, uuid });
