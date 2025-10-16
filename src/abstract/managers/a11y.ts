import { focusGroupKeyUX, hiddenKeyUX, jumpKeyUX, pressKeyUX, startKeyUX } from 'keyux';
import type { Block } from '../Block';

/**
 * MinimalWindow interface is not exported by keyux, so we import it here using tricky way.
 */
type MinimalWindow = Parameters<typeof startKeyUX>[0];
type KeyEventListener = (event: KeyboardEvent) => void;

/**
 * This is global window wrapper that allows to scope event listeners to a specific part of the DOM.
 *
 * It is used to scope the key UX to the widget.
 */
class ScopedMinimalWindow implements MinimalWindow {
  private readonly _listeners = new Map<KeyEventListener, KeyEventListener>();
  private _scope: Node[] = [];

  addEventListener(type: 'keydown' | 'keyup', listener: KeyEventListener): void {
    const wrappedListener: KeyEventListener = (event) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (this._scope.some((el) => el === target || el.contains(target))) {
        listener(event);
      }
    };
    this._listeners.set(listener, wrappedListener);
    window.addEventListener(type, wrappedListener);
  }

  removeEventListener(type: 'keydown' | 'keyup', listener: KeyEventListener): void {
    const wrappedListener = this._listeners.get(listener);
    if (wrappedListener) {
      window.removeEventListener(type, wrappedListener);
    }
    this._listeners.delete(listener);
  }

  get CustomEvent(): typeof CustomEvent {
    return window.CustomEvent;
  }

  get document(): Document {
    return window.document;
  }

  get navigator(): Navigator {
    return window.navigator;
  }

  registerScope(scope: Node): void {
    this._scope.push(scope);
  }

  destroy(): void {
    this._scope = [];
    for (const wrappedListener of this._listeners.values()) {
      window.removeEventListener('keydown', wrappedListener);
      window.removeEventListener('keyup', wrappedListener);
    }
    this._listeners.clear();
  }
}

export class A11y {
  private _destroyKeyUX: ReturnType<typeof startKeyUX> | undefined;
  private readonly _scopedWindow: ScopedMinimalWindow;

  constructor() {
    this._scopedWindow = new ScopedMinimalWindow();
    this._destroyKeyUX = startKeyUX(this._scopedWindow, [
      focusGroupKeyUX(),
      pressKeyUX('is-pressed'),
      jumpKeyUX(),
      hiddenKeyUX(),
    ]);
  }

  registerBlock(scope: Block): void {
    this._scopedWindow.registerScope(scope);
  }

  destroy(): void {
    this._destroyKeyUX?.();
    this._scopedWindow.destroy();
  }
}
