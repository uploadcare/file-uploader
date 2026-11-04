import { debounce } from '../utils/debounce';
import { throttle } from '../utils/throttle';

/**
 * `@throttled(ms)` / `@debounced(ms)` — method decorators for handlers that must be rate-limited AND scoped to their
 * host's lifetime. Any host with an `adoptionSignal` works (`ChildBlock`, `EditorBlock`). The decorator turns the
 * method into a lazily-built, per-instance-cached BOUND rate-limiter with three automatic properties:
 *
 * 1. **Rate-limited** — wraps `utils/debounce` / `utils/throttle`; one limiter per (instance, method), created on
 *    first access.
 * 2. **Lifetime-guarded** — a tick that fires while the host's lifetime has ended (after release, or before adoption)
 *    no-ops, so the body reads its throwing `@inject` fields / `editorController` directly.
 * 3. **Cancelled on release** — a call arms the current lifetime's `signal` to cancel the pending tick once it
 *    aborts; the limiter itself survives, so re-adoption reuses it.
 *
 * The decorated property is a bound, stable reference: `this._x` yields the same limiter every read (safe to hand to
 * `observeCollection(this._x)`), `this._x()` invokes it, and `cancelPending(this._x)` cancels it. Use the `_name`
 * convention, not `#private`.
 */

/** A rate-limited callable with the utils' `cancel`. */
type RateLimiter = ((...args: never[]) => void) & { cancel: () => void };
/** `debounce` / `throttle` share this `(fn, wait) → fn & { cancel }` shape. */
type RateLimiterFactory = (fn: (...args: never[]) => void, wait: number) => RateLimiter;

/** The host slice the decorator reads: aborted while the host is not adopted. */
interface RateLimitedHost {
  readonly adoptionSignal: AbortSignal;
}

const makeDecorator =
  (factory: RateLimiterFactory) =>
  (wait: number) =>
  (proto: object, key: string, descriptor?: PropertyDescriptor): PropertyDescriptor => {
    // The original handler: `descriptor.value` under experimental decorators, falling back to the prototype property.
    const original = (descriptor?.value ?? (proto as Record<string, unknown>)[key]) as (...args: never[]) => void;

    // RETURN the replacement descriptor (a getter) — the TS legacy-decorator emit re-applies whatever we return via
    // `Object.defineProperty`, so mutating the prototype in-body would be clobbered by the original method descriptor.
    // The getter, on first per-instance read, builds the bound limiter and caches it as an own (non-enumerable) data
    // property, so later reads are cheap and return the SAME reference.
    return {
      configurable: true,
      enumerable: false,
      get(this: RateLimitedHost): RateLimiter {
        const limiter = factory((...args: never[]) => {
          if (!this.adoptionSignal.aborted) {
            original.apply(this, args);
          }
        }, wait);
        let armed: AbortSignal | undefined;
        const bound: RateLimiter = Object.assign(
          (...args: never[]) => {
            const signal = this.adoptionSignal;
            if (signal !== armed && !signal.aborted) {
              armed = signal;
              signal.addEventListener('abort', limiter.cancel, { once: true });
            }
            limiter(...args);
          },
          { cancel: limiter.cancel },
        );
        Object.defineProperty(this, key, { value: bound, configurable: true, writable: true, enumerable: false });
        return bound;
      },
    };
  };

/**
 * Cancel a pending call of a `@throttled`/`@debounced` method, passed as `this._method`. The decorator swaps the method
 * for its limiter at runtime, but the declared type stays the method signature, so the `cancel` lives behind this cast.
 */
export const cancelPending = (method: (...args: never[]) => void): void => {
  (method as RateLimiter).cancel();
};

/** Method decorator: rate-limit via `throttle`, lifetime-guarded + release-cancelled. */
export const throttled = makeDecorator(throttle as RateLimiterFactory);

/** Method decorator: rate-limit via `debounce`, lifetime-guarded + release-cancelled. */
export const debounced = makeDecorator(debounce as RateLimiterFactory);
