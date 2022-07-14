/**
 * This will check if the execution environment is a short code snippet, and not the complete HTML-document
 *
 * @param {Function} cb
 */
export function ifRef(cb) {
  !document.querySelector('meta') && !document.querySelector('title') && cb();
}
