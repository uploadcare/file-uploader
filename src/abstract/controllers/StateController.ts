import type { ReactiveStore } from '../di/ReactiveStore';
import type { ObserveOptions } from '../host-subscription';
import { Listeners } from '../host-subscription';

/**
 * Generic DOM-free reactive-state primitive, shared by the config
 * (`ConfigController`) and editor (`CloudImageEditorController`) controllers
 * (the M12 "State scoping principle"). Owns a flat state bag plus a coarse
 * `Listeners` set: `set()` dedupes unchanged writes (`Object.is`) and fires
 * all subscribers on change; `notify()` lets a subclass force a re-render for
 * a change that isn't itself a keyed state write (e.g. an injected-services
 * swap). No `lit`, no DOM — UI bridging belongs to the element/adapter layer.
 *
 * Implements `ReactiveStore<TState>` on the `Listeners`-backed variant: there
 * is no signal backing here, so `getTracked` falls back to the plain read —
 * the interface is intentionally satisfiable by a coarse `Listeners` store.
 */
export class StateController<TState extends object> implements ReactiveStore<TState> {
  protected _state: TState;
  private _listeners = new Listeners();

  public constructor(initial: TState) {
    this._state = initial;
  }

  /** Current state snapshot (read-only reference — mutate via `set`). */
  public get values(): Readonly<TState> {
    return this._state;
  }

  public get<K extends keyof TState>(key: K): TState[K] {
    return this._state[key];
  }

  /** No signal backing here — tracked read falls back to the plain read. */
  public getTracked<K extends keyof TState>(key: K): TState[K] {
    return this._state[key];
  }

  /** Notifies only when the value actually changes (`Object.is` dedup). */
  public set<K extends keyof TState>(key: K, value: TState[K]): void {
    if (Object.is(this._state[key], value)) return;
    this._state[key] = value;
    this._listeners.notify();
  }

  /** Sets several keys at once; per-key `Object.is` dedup, ONE coalesced notify. */
  public setMany(patch: Partial<TState>): void {
    let changed = false;
    for (const key of Object.keys(patch) as (keyof TState)[]) {
      const value = patch[key] as TState[keyof TState];
      if (Object.is(this._state[key], value)) continue;
      this._state[key] = value;
      changed = true;
    }
    if (changed) this._listeners.notify();
  }

  /** Atomic per-key subscription (`Object.is` dedup); `{ immediate }` also fires once now. */
  public observe<K extends keyof TState>(
    key: K,
    listener: (value: TState[K]) => void,
    options?: ObserveOptions,
  ): () => void {
    return this._listeners.observe(() => this._state[key], listener, options);
  }

  /** Coarse subscribe — fires on any state change, not per-key. */
  public subscribe(listener: () => void): () => void {
    return this._listeners.subscribe(listener);
  }

  /** Coarse notify with no state change — for a subclass to call after mutating something descendants read through it that isn't itself a state key. */
  public notify(): void {
    this._listeners.notify();
  }

  public destroy(): void {
    this._listeners.clear();
  }
}
