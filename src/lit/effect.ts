import type { ReactiveElement } from 'lit';
import { boundMethod, collectDecoratedMethods, makeMethodDecorator } from './reactive-method-registry';

/**
 * `@effect()` — a method decorator over the `SignalWatcher` mixin's built-in
 * `updateEffect`. Marks a method as a signal effect: it re-runs whenever any
 * signal it reads (e.g. `config.getTracked(key)`) changes, and is auto-disposed
 * when its host controller is released. The host never tracks the disposer
 * manually.
 *
 * It is the declarative counterpart to a hand-tracked config subscription for
 * the side-effecting sites (a value pushed into a non-reactive sink — the DOM,
 * an iframe, another controller) that can't be expressed as a pure render read.
 * No new reactivity primitive is introduced: `updateEffect` already ships in
 * `@lit-labs/signals` and `ChildBlock` already extends `SignalWatcher`.
 *
 * Effect methods should be `protected` (not `private`): they read like the
 * other overridable lifecycle hooks (`render`/`willUpdate`), the decorator
 * walks the prototype chain so a subclass can override one, and it keeps the
 * `noUnusedPrivateClassMembers` lint from flagging a method invoked only
 * reflectively.
 *
 * Timing: by default an effect first runs after the host's next update
 * (`updateComplete`), then on every change to a signal it read. Pass
 * `{ beforeUpdate: true }` to run it synchronously on registration and before
 * each update instead — this fires eagerly (pre-paint) and keeps firing on
 * change even while the host gates rendering (`shouldUpdate → false`), so it
 * suits host-attribute writes that must land before first paint.
 */
export interface EffectOptions {
  /** Run before the element updates (and eagerly, synchronously, on registration). Default: after. */
  beforeUpdate?: boolean;
  /** Opt out of auto-dispose on disconnect (the host owns teardown otherwise). */
  manualDispose?: boolean;
}

/** The slice of the `SignalWatcher` mixin API an effect host must expose. */
export interface EffectHost extends ReactiveElement {
  updateEffect(fn: () => void, options?: EffectOptions): () => void;
}

const EFFECT = Symbol('uc.effect');

/** Method decorator — registers the method as a signal effect on its host. */
export const effect = makeMethodDecorator<EffectOptions>(EFFECT);

/**
 * Wire every `@effect()` method on `host` via `updateEffect`, returning the
 * disposers for the host to track.
 *
 * The returned disposers are connected-guarded: `updateEffect` auto-disposes on
 * disconnect and its manual disposer nils the mixin's shared watcher once the
 * host is disconnected — so draining >1 of them during `disconnectedCallback`
 * would throw on the second. We therefore only dispose manually while the host
 * is still connected (a ctx re-adoption without a disconnect); on a real
 * disconnect the mixin's own auto-unwatch tears the effects down.
 */
export function registerHostEffects(host: EffectHost): Array<() => void> {
  const disposers: Array<() => void> = [];
  for (const { key, options } of collectDecoratedMethods<EffectOptions>(host, EFFECT)) {
    const fn = boundMethod(host, key);
    if (!fn) continue;
    const dispose = host.updateEffect(() => fn(), options);
    disposers.push(() => {
      if (host.isConnected) dispose();
    });
  }
  return disposers;
}
