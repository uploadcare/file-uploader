// Reference-counted body scroll lock. The body stays unscrollable while at
// least one acquisition is live, so overlapping holders (a modal-to-modal
// swap, several uploader instances on one page) can't unlock it from under
// each other — the failure mode of every holder writing
// `document.body.style.overflow` directly.
let count = 0;
// The host page's own overflow value, captured when the first acquisition
// locks and restored when the last one releases.
let restoreTo = '';

/**
 * Lock body scrolling. Returns an idempotent release: calling it more than
 * once (e.g. from both a hide path and `disconnectedCallback`) frees only
 * this acquisition.
 */
export function acquireScrollLock(): () => void {
  if (count++ === 0) {
    restoreTo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--count === 0) document.body.style.overflow = restoreTo;
  };
}
