/** @type {typeof window.ResizeObserver} */
class LrResizeObserver {
  /** @param {Function} callback */
  constructor(callback) {
    this._callback = callback;
  }

  /** @param {Element} el */
  _flush(el) {
    let rect = el.getBoundingClientRect();
    if (JSON.stringify(rect) !== JSON.stringify(this._lastRect)) {
      this._callback([
        {
          borderBoxSize: [
            {
              inlineSize: rect.width,
              blockSize: rect.height,
            },
          ],
          contentBoxSize: [
            {
              inlineSize: rect.width,
              blockSize: rect.height,
            },
          ],
          contentRect: rect,
          target: el,
        },
      ]);
    }
    this._lastRect = rect;
  }

  /** @param {Element} el */
  observe(el) {
    this.unobserve();
    this._observeInterval = window.setInterval(() => this._flush(el), 500);
    this._flush(el);
  }

  /** @param {Element} [el] */
  unobserve(el) {
    if (this._observeInterval) {
      window.clearInterval(this._observeInterval);
    }
  }

  disconnect() {}
}

/** @type {typeof window.ResizeObserver} */
export const ResizeObserver = window.ResizeObserver;
