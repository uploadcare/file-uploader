import { Listeners } from '../host-subscription';

/**
 * Mixin base-constructor shape. The `any[]` rest parameter is mandated by the
 * TypeScript mixin pattern (error 2545 otherwise) and mirrors the repo's own
 * `src/lit/Constructor.ts`; it is a type-parameter constraint, not a cast.
 */
// biome-ignore lint/suspicious/noExplicitAny: required by the TS mixin pattern (TS2545).
type Constructor<T = object> = new (...args: any[]) => T;

export interface DisposableApi {
  addDisposer(dispose: () => void): void;
  destroy(): void;
}

/**
 * Adds a disposer registry to a controller. `destroy()` runs disposers in
 * reverse (LIFO) registration order and isolates a throwing disposer so the
 * rest still run.
 */
export function Disposable<TBase extends Constructor>(Base: TBase): TBase & Constructor<DisposableApi> {
  return class DisposableMixin extends Base implements DisposableApi {
    readonly #disposers: (() => void)[] = [];

    public addDisposer(dispose: () => void): void {
      this.#disposers.push(dispose);
    }

    public destroy(): void {
      for (let i = this.#disposers.length - 1; i >= 0; i--) {
        try {
          this.#disposers[i]!();
        } catch (err) {
          console.warn('[uc] a disposer threw', err);
        }
      }
      this.#disposers.length = 0;
    }
  };
}

export interface SubscribableApi {
  subscribe(listener: () => void): () => void;
  notify(): void;
}

/**
 * Adds a coarse `subscribe()`/`notify()` surface to a controller — the compat
 * shim blocks lean on while migrating from imperative subscription to
 * `SignalWatcher` reads. Retired once no consumer needs it.
 */
export function Subscribable<TBase extends Constructor>(Base: TBase): TBase & Constructor<SubscribableApi> {
  return class SubscribableMixin extends Base implements SubscribableApi {
    readonly #listeners = new Listeners();

    public subscribe(listener: () => void): () => void {
      return this.#listeners.subscribe(listener);
    }

    public notify(): void {
      this.#listeners.notify();
    }
  };
}
