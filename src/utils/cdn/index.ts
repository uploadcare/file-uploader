/**
 * The internal CDN URL API. Consumers import from here and nowhere else — not
 * from `@uploadcare/cdn-url` directly, so the library surface we depend on stays
 * visible in one file.
 *
 * Reading and writing a URL keep the library's names, which are already the right
 * words. Only the pieces that are ours are added: the two string edges, an append
 * helper, and origin policy.
 *
 * The kind-dispatching `parseCdnUrl`/`serializeCdnUrl` are deliberately **not**
 * re-exported. Nothing here needs them, and every bundle measured smaller once the
 * last consumer moved off them — leaving them reachable just invites the dispatch
 * back in by reflex. Import them here again only with a call site that genuinely
 * handles more than one URL kind.
 *
 * `parseFileUrl` is the one worth a word: it narrows to a single stored file, so
 * callers read `uuid`/`operations`/`filename` without discriminating on `kind`.
 * Most of this codebase only ever handles single-file URLs — a thumbnail, an
 * editor source, an upload entry — and branching over group and delivery-proxy
 * kinds at those call sites invents behaviour for inputs that should not arrive.
 * It throws instead, and the callers that already catch (`<uc-img>` URL building,
 * the editor's `updateImage`, `addFileFromCdnUrl`) degrade as they do for any
 * other unusable URL.
 */
export {
  type CdnOperation,
  isProxyUrl,
  parseFileUrl,
  parseProxyUrl,
  serializeFileUrl,
  serializeOperations,
  serializeProxyUrl,
} from '@uploadcare/cdn-url';
// The typed-literal API lives on the `/tiny` entry as of 6.20.0-alpha.5 — it moved
// off the root entry there, alongside the string-surgery url helpers.
export { modifiers, type OperationLiteral, unsafeOperation } from '@uploadcare/cdn-url/tiny';
export { operationsFromModifiers, withOperations } from './operations';
export { DEFAULT_CDN_ORIGIN, deliveryProxyOrigin } from './origin';
