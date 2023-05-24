/**
 * This will check if the execution environment is a short code snippet, and not the complete HTML-document
 *
 * @param {Function} cb
 */
export function ifRef(cb) {
  // @ts-ignore
  typeof window.__IS_REF__ === 'boolean' && !!window.__IS_REF__ && cb();
}
