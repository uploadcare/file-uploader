/**
 * The internal CDN URL API. Consumers import from here and nowhere else — not
 * from `@uploadcare/cdn-url` directly, so the library surface we depend on stays
 * visible in one file.
 *
 * Reading and writing a URL keep the library's names, which are already the right
 * words. Only the pieces that are ours are added: the two string edges, an append
 * helper, and origin policy.
 */
export { type CdnOperation, type ParsedCdnUrl, parseCdnUrl, serializeCdnUrl } from '@uploadcare/cdn-url';
export { modifiersFromOperations, operationsFromModifiers, parseFileUrl, withOperations } from './operations';
export { DEFAULT_CDN_ORIGIN, deliveryProxyOrigin } from './origin';
