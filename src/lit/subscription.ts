import { boundMethod, collectDecoratedMethods, makeMethodDecorator } from './reactive-method-registry';

/**
 * `@subscription()` — a method decorator for imperative (non-signal)
 * subscriptions that can't be expressed as a signal `@effect`: collection
 * observers, `pluginManager.onPluginsChange`, `router.subscribe`, etc.
 *
 * The decorated method runs once when the host controller is adopted and
 * returns its teardown closure (an `Unsubscribe`, or `void` if there's nothing
 * to tear down). The host tracks that closure and runs it on release — so the
 * host never calls `addDisposer` by hand. Re-adoption re-runs the method.
 *
 * For a compound wiring (e.g. `whenController` that later attaches observers),
 * compose the teardowns locally and return a single closure that runs them all.
 *
 * Like `@effect`, subscription methods should be `protected` (overridable
 * lifecycle hooks, invoked reflectively).
 */
export type Unsubscribe = () => void;

const SUBSCRIPTION = Symbol('uc.subscription');

/** Method decorator — registers the method as an auto-disposed subscription. */
export const subscription = makeMethodDecorator<void>(SUBSCRIPTION);

/**
 * Run every `@subscription()` method on `host` and return the teardown closures
 * they produced (methods that return a non-function are treated as having no
 * teardown). The host tracks these for release.
 */
export function registerHostSubscriptions(host: object): Array<Unsubscribe> {
  const teardowns: Array<Unsubscribe> = [];
  for (const { key } of collectDecoratedMethods<void>(host, SUBSCRIPTION)) {
    const fn = boundMethod(host, key);
    if (!fn) continue;
    const cleanup = fn();
    if (typeof cleanup === 'function') {
      teardowns.push(cleanup as Unsubscribe);
    }
  }
  return teardowns;
}
