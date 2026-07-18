import { focusGroupKeyUX, hiddenKeyUX, jumpKeyUX, pressKeyUX, startKeyUX } from 'keyux';
import type { Destroyable } from '../di/ControllerContainer';
import { Disposables } from '../di/Disposables';

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
  // Each entry carries the wrapped listener plus its `#disposables` canceller, so
  // `removeEventListener` can both detach the listener and un-register its
  // teardown — keeping `destroy()`'s `run()` from re-removing an already-removed
  // listener (keyux's own teardown removes each listener before `destroy()`).
  private readonly _listeners = new Map<KeyEventListener, { wrapped: KeyEventListener; cancel: () => void }>();
  readonly #disposables = new Disposables();
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
    window.addEventListener(type, wrappedListener);
    const cancel = this.#disposables.add(() => window.removeEventListener(type, wrappedListener));
    this._listeners.set(listener, { wrapped: wrappedListener, cancel });
  }

  public removeEventListener(type: 'keydown' | 'keyup', listener: KeyEventListener): void {
    const entry = this._listeners.get(listener);
    if (entry) {
      window.removeEventListener(type, entry.wrapped);
      entry.cancel();
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
    // Runs one `removeEventListener('keydown'/'keyup', …)` teardown per attached
    // wrapped listener (isolate-and-warn), matching the previous manual loop.
    this.#disposables.run();
    this._listeners.clear();
  }
}

export class A11y implements Destroyable {
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

  /**
   * Only reaches into `scope` as a `Node` (forwarded to
   * `ScopedMinimalWindow.registerScope`) — widened from `LitBlock` (v1) so
   * v2 `ChildBlock`-based elements can register too, without a cast.
   */
  public registerBlock(scope: Node): void {
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
