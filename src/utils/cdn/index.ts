/**
 * The internal CDN URL API. Consumers import from here and nowhere else — not
 * from `@uploadcare/cdn-url` directly, so the library surface we depend on stays
 * visible in one file.
 *
 * Reading and writing a URL keep the library's names, which are already the right
 * words. Only the pieces that are ours are added: the two string edges, an append
 * helper, and origin policy.
 */
/**
 * Parse a URL that must address a single stored file, narrowing the result so
 * callers read `uuid`/`operations`/`filename` without discriminating on `kind`.
 *
 * Most of this codebase only ever handles single-file URLs — a thumbnail, an
 * editor source, an upload entry. Branching over group and delivery-proxy kinds
 * at those call sites invents behaviour for inputs that should not arrive; this
 * fails loudly instead, and callers that already catch (`<uc-img>` URL building,
 * the editor's `updateImage`, `addFileFromCdnUrl`) degrade as they do for any
 * other unusable URL.
 */
export { type CdnOperation, type ParsedCdnUrl, parseCdnUrl, parseFileUrl, serializeCdnUrl } from '@uploadcare/cdn-url';
export { modifiersFromOperations, operationsFromModifiers, withOperations } from './operations';
export { DEFAULT_CDN_ORIGIN, deliveryProxyOrigin } from './origin';
