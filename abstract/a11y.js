// @ts-check
import { startKeyUX, hiddenKeyUX, jumpKeyUX, focusGroupKeyUX, pressKeyUX } from 'keyux';

/**
 * MinimalWindow interface is not exported by keyux, so we import it here using tricky way.
 *
 * @typedef {Parameters<import('keyux').KeyUXModule>[0]} MinimalWindow
 */

/**
 * This is global window wrapper that allows to scope event listeners to a specific part of the DOM.
 *
 * It is used to scope the key UX to the widget.
 *
 * @implements {MinimalWindow}
 */
class ScopedMinimalWindow {
  /** @private */
  _listeners = new Map();

  /**
   * @private
   * @type {Node[]}
   */
  _scope = [];

  /**
   * @param {'keydown' | 'keyup'} type
   * @param {(event: Event) => void} listener
   */
  addEventListener(type, listener) {
    /** @param {Event} e */
    const wrappedListener = (e) => {
      const target = e.target;
      if (!target) return;
      if (this._scope.some((el) => el === e.target || el.contains(/** @type {Node} */ (target)))) {
        listener(e);
      }
    };
    this._listeners.set(listener, wrappedListener);
    window.addEventListener(type, wrappedListener);
  }

  /**
   * @param {'keydown' | 'keyup'} type
   * @param {(event: {}) => void} listener
   */
  removeEventListener(type, listener) {
    const wrappedListener = this._listeners.get(listener);
    if (wrappedListener) {
      window.removeEventListener(type, wrappedListener);
    }
  }

  get document() {
    return window.document;
  }

  get navigator() {
    return window.navigator;
  }

  /** @param {Node} scope */
  registerScope(scope) {
    this._scope.push(scope);
  }

  destroy() {
    this._scope = [];
  }
}

export class A11y {
  /**
   * @private
   * @type {(() => void) | undefined}
   */
  _destroyKeyUX;

  /**
   * @private
   * @type {ScopedMinimalWindow}
   */
  _scopedWindow;

  constructor() {
    this._scopedWindow = new ScopedMinimalWindow();
    this._destroyKeyUX = startKeyUX(this._scopedWindow, [
      focusGroupKeyUX(),
      pressKeyUX('is-pressed'),
      jumpKeyUX(),
      hiddenKeyUX(),
    ]);
  }

  /** @param {import('./Block.js').Block} scope */
  registerBlock(scope) {
    this._scopedWindow.registerScope(scope);
  }

  destroy() {
    this._destroyKeyUX?.();
    this._scopedWindow.destroy();
  }
}
