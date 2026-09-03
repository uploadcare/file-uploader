import type { ControllerContainer } from '../abstract/di/ControllerContainer';
import { debounce } from '../utils/debounce';
import { throttle } from '../utils/throttle';
import { collectDecoratedMethods, makeMethodDecorator } from './reactive-method-registry';

/**
 * `@throttled(ms)` / `@debounced(ms)` — method decorators for `ChildBlock`
 * handlers that must be rate-limited AND scoped to the block's controller
 * adoption. Siblings of `@effect` / `@subscription`, but where those run once at
 * adoption and return a teardown, a rate-limited handler is called MANY times
 * over the block's life — so the decorator turns the method into a lazily-built,
 * per-instance-cached BOUND rate-limiter with three automatic properties:
 *
 * 1. **Rate-limited** — wraps `utils/debounce` / `utils/throttle`; one limiter
 *    per (instance, method), created on first access.
 * 2. **Adopted-guarded** — a call after release (or before adoption) no-ops, so
 *    the body reads its throwing `@inject` fields directly (no `useOrNull`
 *    inside) — the guard lives at the one edge, not scattered through the body.
 * 3. **Cancelled on release** — `registerHostRateLimited` (run by `ChildBlock`
 *    at adoption, next to `registerHostEffects` / `registerHostSubscriptions`)
 *    returns a teardown that cancels every pending limiter on release; the
 *    limiter itself survives so re-adoption reuses it.
 *
 * The decorated property is a bound, stable reference: `this._x` yields the same
 * limiter every read (safe to hand to `observeCollection(this._x)`), `this._x()`
 * invokes it, and `this._x.cancel()` cancels it — byte-for-byte with the
 * `private _x = throttle(this._raw.bind(this), ms)` field it replaces. Use the
 * `_name` convention (a runtime string key the registry reads), not `#private`.
 */

/** A rate-limited callable with the utils' `cancel`. */
type RateLimiter = ((...args: never[]) => void) & { cancel: () => void };
/** `debounce` / `throttle` share this `(fn, wait) → fn & { cancel }` shape. */
type RateLimiterFactory = (fn: (...args: never[]) => void, wait: number) => RateLimiter;

/** The `ChildBlock` slice the guard reads — a null container means "not adopted". */
interface RateLimitedHost {
  readonly containerOrNull: ControllerContainer | null;
}

// Per-instance set of created limiters, so release can cancel every pending one.
const STORE = Symbol('uc.rateLimited.store');
// Marks a class as having rate-limited methods, so the host only registers the
// cancel-all teardown when there is something to cancel.
const RATE_LIMITED = Symbol('uc.rateLimited');
const record = makeMethodDecorator<void>(RATE_LIMITED);

type StoreHost = RateLimitedHost & { [STORE]?: Set<RateLimiter> };

const makeDecorator =
  (factory: RateLimiterFactory) =>
  (wait: number) =>
  (proto: object, key: string, descriptor?: PropertyDescriptor): PropertyDescriptor => {
    // The original handler: `descriptor.value` under experimental decorators,
    // falling back to the prototype property.
    const original = (descriptor?.value ?? (proto as Record<string, unknown>)[key]) as (...args: never[]) => void;
    record()(proto, key);

    // RETURN the replacement descriptor (a getter) — the TS legacy-decorator
    // emit re-applies whatever we return via `Object.defineProperty`, so
    // mutating the prototype in-body would be clobbered by the original method
    // descriptor. The getter, on first per-instance read, builds the bound
    // limiter, caches it as an own (non-enumerable) data property (so later reads
    // are cheap and return the SAME reference — safe to hand to `observe`), and
    // registers it for release-cancel.
    return {
      configurable: true,
      enumerable: false,
      get(this: StoreHost): RateLimiter {
        const limiter = factory((...args: never[]) => {
          // Adopted-guard: a tick that fires after release must not run the body
          // (whose `@inject` reads would throw on a released container).
          if (this.containerOrNull) {
            original.apply(this, args);
          }
        }, wait);
        let store = this[STORE];
        if (!store) {
          store = new Set<RateLimiter>();
          this[STORE] = store;
        }
        store.add(limiter);
        Object.defineProperty(this, key, {
          value: limiter,
          configurable: true,
          writable: true,
          enumerable: false,
        });
        return limiter;
      },
    };
  };

/** Method decorator: rate-limit via `throttle`, adopted-guarded + release-cancelled. */
export const throttled = makeDecorator(throttle as RateLimiterFactory);

/** Method decorator: rate-limit via `debounce`, adopted-guarded + release-cancelled. */
export const debounced = makeDecorator(debounce as RateLimiterFactory);

/**
 * Cancel every pending `@throttled` / `@debounced` limiter on `host` when the
 * returned teardown runs (on controller release). The limiters themselves stay
 * cached on the instance, so re-adoption reuses them. Returns an empty array for
 * a host with no rate-limited methods, so the common block registers nothing.
 */
export function registerHostRateLimited(host: object): Array<() => void> {
  if (collectDecoratedMethods<void>(host, RATE_LIMITED).length === 0) {
    return [];
  }
  return [
    () => {
      const store = (host as StoreHost)[STORE];
      if (store) {
        for (const limiter of store) {
          limiter.cancel();
        }
      }
    },
  ];
}
