import { type Signal, signal } from '@lit-labs/signals';

/**
 * Experimental property decorator that backs a plain field with a per-instance
 * `@lit-labs/signals` signal. Reads auto-track under a `SignalWatcher` (or the
 * `watch` directive); writes dedup with `Object.is`.
 *
 * With `useDefineForClassFields: false` a field initializer (`x = init`) runs
 * as an assignment in the constructor, so it flows through the prototype setter
 * defined here and seeds the signal — no base class required.
 */
export function signalState() {
  return (target: object, key: string): void => {
    const store = new WeakMap<object, Signal.State<unknown>>();
    const sig = (inst: object): Signal.State<unknown> => {
      let s = store.get(inst);
      if (!s) {
        s = signal<unknown>(undefined);
        store.set(inst, s);
      }
      return s;
    };
    Object.defineProperty(target, key, {
      get(this: object): unknown {
        return sig(this).get();
      },
      set(this: object, v: unknown): void {
        const s = sig(this);
        if (Object.is(s.get(), v)) {
          return;
        }
        s.set(v);
      },
      enumerable: true,
      configurable: true,
    });
  };
}
