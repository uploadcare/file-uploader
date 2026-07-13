import { focusGroupKeyUX, hiddenKeyUX, jumpKeyUX, pressKeyUX, startKeyUX } from 'keyux';
import type { LitBlock } from '../../lit/LitBlock';
import type { ISharedInstance } from '../../lit/shared-instances';

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

  public addEventListener(type: 'keydown' | 'keyup', listener: KeyEventListener): void {
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

  public removeEventListener(type: 'keydown' | 'keyup', listener: KeyEventListener): void {
    const wrappedListener = this._listeners.get(listener);
    if (wrappedListener) {
      window.removeEventListener(type, wrappedListener);
    }
    this._listeners.delete(listener);
  }

  public get CustomEvent(): typeof CustomEvent {
    return window.CustomEvent;
  }

  public get document(): Document {
    return window.document;
  }

  public get navigator(): Navigator {
    return window.navigator;
  }

  public registerScope(scope: Node): void {
    this._scope.push(scope);
  }

  public destroy(): void {
    this._scope = [];
    for (const wrappedListener of this._listeners.values()) {
      window.removeEventListener('keydown', wrappedListener);
      window.removeEventListener('keyup', wrappedListener);
    }
    this._listeners.clear();
  }
}

export class A11y implements ISharedInstance {
  private _destroyKeyUX: ReturnType<typeof startKeyUX> | undefined;
  private readonly _scopedWindow: ScopedMinimalWindow;
  private _armed = false;
  private _destroyed = false;

  public constructor() {
    this._scopedWindow = new ScopedMinimalWindow();
  }

  /**
   * Attaches the keyux window listeners. Lazy: called on first
   * `registerBlock` rather than at construction, so a constructed-but-unused
   * instance never touches `window`.
   */
  private _arm(): void {
    if (this._armed || this._destroyed) {
      return;
    }
    this._armed = true;
    this._destroyKeyUX = startKeyUX(this._scopedWindow, [
      focusGroupKeyUX(),
      pressKeyUX('is-pressed'),
      jumpKeyUX(),
      hiddenKeyUX(),
    ]);
  }

  public registerBlock(scope: LitBlock): void {
    if (this._destroyed) {
      return;
    }
    this._scopedWindow.registerScope(scope);
    this._arm();
  }

  public destroy(): void {
    this._destroyed = true;
    this._armed = false;
    this._destroyKeyUX?.();
    this._destroyKeyUX = undefined;
    this._scopedWindow.destroy();
  }
}
