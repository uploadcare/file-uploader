import { ConfigController } from './controllers/ConfigController';
import { RouterController } from './controllers/RouterController';
import { ControllerContainer } from './di/ControllerContainer';
import { logger } from './logger';
import { TelemetryManager } from './managers/TelemetryManager';

/**
 * Global registry of uploader scopes keyed by `ctx-name`, and the single
 * authoritative home of the per-ctx `ControllerContainer` lifecycle:
 * create-and-cache (`ensure`), reactive lookup (`whenAvailable`/`get`), and
 * dispose-on-teardown (`dispose`). Children that live outside the uploader's
 * DOM subtree resolve their per-ctx DI `ControllerContainer` through this
 * registry (the cross-DOM equivalent of `@lit/context`) and pull the
 * controllers they need off it.
 *
 * M-god step 9c: this registry is the SOLE per-ctx state/instance mechanism —
 * the v1 ctx/per-ctx store/`bag` layer is gone. `ensure` creates + caches the
 * container (with eager Config -> Router -> Telemetry init), `dispose` tears it
 * down, and `whenAvailable`/`get` are the reactive/plain lookups.
 *
 * The lookup is reactive — `whenAvailable(ctxName, cb)` fires synchronously
 * if a container is already registered, immediately when one registers, and
 * AGAIN whenever the registration changes (e.g. the owning element is removed
 * and a new one with the same `ctx-name` is rendered). This lets consumers
 * re-adopt across a remount without losing their bindings. It also fires with
 * `null` when the registered container for that `ctxName` is actually
 * unregistered (the owning element disconnected and nothing has taken its
 * place yet) — consumers must release the container, not just ignore the
 * notification, so they don't outlive the ctx they were reading from.
 *
 * Introduced as a standalone primitive in M0; the god-object `UploaderController`
 * it once registered was dissolved in M-god step 8e, so the registered value is
 * now the ctx's `ControllerContainer` directly.
 */
/** A single `whenAvailable` subscription. Wrapped in its own object (rather
 * than storing the callback directly) so two subscriptions passing the SAME
 * callback reference still occupy two distinct entries — deduping by
 * identity would let one unsubscribe silently evict the other. */
interface ConsumerSubscription {
  cb: (c: ControllerContainer | null) => void;
}

class UploaderRegistryImpl {
  private _map = new Map<string, ControllerContainer>();
  private _consumers = new Map<string, Set<ConsumerSubscription>>();

  /**
   * Fan out a registration change to every `whenAvailable` consumer for
   * `ctxName`. Isolate each consumer: a single throwing callback must not abort
   * notification of the others or bubble out of the caller. Snapshot first — a
   * consumer's callback may synchronously subscribe/unsubscribe (mutating the
   * set) during notification.
   */
  private _notifyConsumers(ctxName: string, container: ControllerContainer | null): void {
    const set = this._consumers.get(ctxName);
    if (!set) {
      return;
    }
    for (const sub of [...set]) {
      try {
        sub.cb(container);
      } catch (err) {
        logger.warn(`a whenAvailable consumer for ctx-name="${ctxName}" threw`, err);
      }
    }
  }

  /**
   * Get the ctx's `ControllerContainer`, creating (and caching + notifying
   * consumers) it on first request. This is the sole container-creation path.
   *
   * The eager Config -> Router -> Telemetry init below fires at the exact moment
   * the container is created, on every creation path (`ensureUploaderCtx`, a
   * direct `ensure` call). Order matters:
   *  - `config` first -> disposed LAST (telemetry's config unsubscribe runs
   *    during teardown; it is a safe no-op even after config is disposed);
   *  - `router` before `telemetry` (telemetry reads `router.currentActivity`);
   *  - `telemetry` last, so its `init()` subscribes to the bus BEFORE any event
   *    can fire — the observer then sees every emitted event.
   */
  public ensure(ctxName: string): ControllerContainer {
    const existing = this._map.get(ctxName);
    if (existing) {
      // Idempotent: the container caches its controllers, so this returns the
      // same instances resolved at creation time (no re-init).
      return existing;
    }
    const container = new ControllerContainer();
    // Cache BEFORE the eager init so a re-entrant `ensure`/`get` during that
    // init resolves this same instance.
    this._map.set(ctxName, container);
    try {
      container.get(ConfigController);
      container.get(RouterController);
      container.get(TelemetryManager);
    } catch (err) {
      // Eager init threw: roll the half-built container back out of `_map` so a
      // later `ensure()` retries a clean creation (instead of returning the
      // partial container and skipping init) and no consumer is ever notified of
      // it. Guard `=== container` in case a re-entrant `register()` already
      // replaced it. Best-effort dispose, then rethrow.
      if (this._map.get(ctxName) === container) {
        this._map.delete(ctxName);
      }
      container.dispose();
      throw err;
    }
    // Notify `whenAvailable` subscribers AFTER the eager init — the same point
    // `register()` notifies from.
    this._notifyConsumers(ctxName, container);
    return container;
  }

  /**
   * Tear down the ctx's container: null-notify consumers (so they release
   * BEFORE the controllers are destroyed — the v1 teardown order) then dispose.
   * No-op if no container exists. Delegates to `unregister` for the delete +
   * null-notify so that ordering stays identical.
   */
  public dispose(ctxName: string): void {
    const container = this._map.get(ctxName);
    if (!container) {
      return;
    }
    this.unregister(ctxName, container);
    container.dispose();
  }

  public register(ctxName: string, container: ControllerContainer): void {
    const existing = this._map.get(ctxName);
    if (existing && existing !== container) {
      // Common case: the previous owning element disconnected and its
      // deferred unregister hasn't fired yet. The new element takes over; the
      // deferred unregister becomes a no-op (it checks identity before
      // deleting).
      logger.warn(
        `Replacing the container registered under ctx-name="${ctxName}". If two uploaders share this name simultaneously the second one wins.`,
      );
    }
    this._map.set(ctxName, container);
    // Notify every subscriber for this ctxName so they re-adopt the new
    // container.
    this._notifyConsumers(ctxName, container);
  }

  public unregister(ctxName: string, container: ControllerContainer): void {
    if (this._map.get(ctxName) !== container) {
      // Stale unregister (e.g. deferred from a disconnected element already
      // replaced by a new registration) — the current owner is unaffected.
      return;
    }
    this._map.delete(ctxName);
    this._notifyConsumers(ctxName, null);
  }

  public get(ctxName: string): ControllerContainer | undefined {
    return this._map.get(ctxName);
  }

  /**
   * Whether any `whenAvailable` consumer is currently watching `ctxName`.
   *
   * Was the consumer-refcount teardown predicate until M-god step 6a, which
   * moved that role onto the per-ctx `ControllerContainer`
   * (`container.isUnreferenced()`, see `ctx-lifecycle.isCtxUnreferenced`). Kept
   * as a standalone registry query. (The v1 `*blocksRegistry` half was removed
   * with the v1 element layer in M11.)
   */
  public hasConsumers(ctxName: string): boolean {
    return (this._consumers.get(ctxName)?.size ?? 0) > 0;
  }

  /**
   * Subscribe to the container under `ctxName`. Fires synchronously with the
   * current container (if registered), then again each time a new container
   * registers under the same name, and with `null` when that container is
   * unregistered (its ctx is gone — consumers must release, not just wait for
   * a replacement that may never come). Returns an unsubscribe.
   */
  public whenAvailable(ctxName: string, cb: (c: ControllerContainer | null) => void): () => void {
    let set = this._consumers.get(ctxName);
    if (!set) {
      set = new Set();
      this._consumers.set(ctxName, set);
    }
    // A fresh wrapper per call — even if `cb` is the same function reference
    // as an existing subscription, this is a distinct slot in the Set so the
    // two subscriptions' lifecycles stay independent (see `ConsumerSubscription`).
    const sub: ConsumerSubscription = { cb };
    set.add(sub);
    const existing = this._map.get(ctxName);
    if (existing) cb(existing);
    return () => {
      set.delete(sub);
      // Drop the empty consumer Set so unused ctx-names don't accumulate in
      // this module-level singleton over the app's lifetime.
      if (set.size === 0) this._consumers.delete(ctxName);
    };
  }
}

export const UploaderRegistry = new UploaderRegistryImpl();
