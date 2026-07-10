/**
 * Reference-counted body scroll lock. The body stays unscrollable while at
 * least one acquisition is live, so overlapping holders (a modal-to-modal
 * swap, several uploader instances on one page) can't unlock it from under
 * each other — the failure mode of every holder writing
 * `document.body.style.overflow` directly.
 */
export type ScrollLock = {
  /**
   * Lock body scrolling. Returns an idempotent release: calling it more than
   * once (e.g. from both a hide path and `disconnectedCallback`) frees only
   * this acquisition.
   */
  acquire: () => () => void;
};

export function createScrollLock(doc: Document): ScrollLock {
  let count = 0;
  // The host page's own overflow value, captured when the first acquisition
  // locks and restored when the last one releases.
  let restoreTo = '';

  return {
    acquire: () => {
      if (count === 0) {
        restoreTo = doc.body.style.overflow;
        doc.body.style.overflow = 'hidden';
      }
      count += 1;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        count -= 1;
        if (count === 0) {
          doc.body.style.overflow = restoreTo;
        }
      };
    },
  };
}

const locksByDocument = new WeakMap<Document, ScrollLock>();

/** The shared per-document lock — all holders on one page must use this. */
export function getScrollLock(doc: Document): ScrollLock {
  let lock = locksByDocument.get(doc);
  if (!lock) {
    lock = createScrollLock(doc);
    locksByDocument.set(doc, lock);
  }
  return lock;
}
