import { logger } from '../abstract/logger';
import { boundMethod, collectDecoratedMethods, makeMethodDecorator } from './reactive-method-registry';

const log = logger.scope('subscription');

/**
 * `@subscription()` — a method decorator for imperative (non-signal)
 * subscriptions that can't be expressed as a signal `@effect`: collection
 * observers, `pluginManager.onPluginsChange`, `router.subscribe`, etc.
 *
 * The decorated method runs once when the host controller is adopted and
 * returns its teardown(s): a single `Unsubscribe`, an array of them (for a
 * compound wiring — no manual wrapping needed), or `void` if there's nothing to
 * tear down. The host tracks them and runs them on release — so the host never
 * calls `addDisposer` by hand. Re-adoption re-runs the method.
 *
 * Like `@effect`, subscription methods should be `protected` (overridable
 * lifecycle hooks, invoked reflectively).
 */
export type Unsubscribe = () => void;

/** What a `@subscription()` method may return. */
export type SubscriptionTeardown = Unsubscribe | Unsubscribe[] | void;

const SUBSCRIPTION = Symbol('uc.subscription');

/** Method decorator — registers the method as an auto-disposed subscription. */
export const subscription = makeMethodDecorator<void>(SUBSCRIPTION);

/**
 * Run every `@subscription()` method on `host` and return the teardown closures
 * they produced — a returned array is flattened, and non-function entries are
 * ignored. The host tracks these for release.
 *
 * Isolate-and-warn: a throwing method is contained (logged via the host's
 * scoped logger when reachable, else the module logger) so the remaining
 * methods still register and any teardowns already collected are kept.
 */
export function registerHostSubscriptions(host: object): Array<Unsubscribe> {
  const teardowns: Array<Unsubscribe> = [];
  const warn = (host as { _log?: { warn: (...args: unknown[]) => void } })._log?.warn ?? log.warn;
  for (const { key } of collectDecoratedMethods<void>(host, SUBSCRIPTION)) {
    const fn = boundMethod(host, key);
    if (!fn) continue;
    let result: SubscriptionTeardown;
    try {
      result = fn() as SubscriptionTeardown;
    } catch (err) {
      warn(`a @subscription method (${String(key)}) threw during registration`, err);
      continue;
    }
    for (const teardown of Array.isArray(result) ? result : [result]) {
      if (typeof teardown === 'function') {
        teardowns.push(teardown);
      }
    }
  }
  return teardowns;
}
