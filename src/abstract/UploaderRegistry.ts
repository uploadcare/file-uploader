import { ConfigController } from './controllers/ConfigController';
import { RouterController } from './controllers/RouterController';
import { ControllerContainer } from './di/ControllerContainer';
import { logger } from './logger';
import { TelemetryManager } from './managers/TelemetryManager';

const log = logger.scope('uploader-registry');

/** A single `whenAvailable` subscription. Wrapped in its own object (rather
 * than storing the callback directly) so two subscriptions passing the SAME
 * callback reference still occupy two distinct entries — deduping by
 * identity would let one unsubscribe silently evict the other. */
interface ConsumerSubscription {
  cb: (c: ControllerContainer | null) => void;
}

/**
 * Global registry of uploader scopes keyed by `ctx-name`, and the single
 * authoritative home of the per-ctx `ControllerContainer` lifecycle:
 * create-and-cache (`ensure`, with eager Config -> Router -> Telemetry init),
 * reactive lookup (`whenAvailable`/`get`), and dispose-on-teardown (`dispose`).
 * Children that live outside the uploader's DOM subtree resolve their per-ctx
 * DI `ControllerContainer` through this registry (the cross-DOM equivalent of
 * `@lit/context`) and pull the controllers they need off it.
 *
 * The lookup is reactive — `whenAvailable(ctxName, cb)` fires synchronously
 * if a container is already registered, immediately when one is created, and
 * AGAIN whenever the registration changes (e.g. the ctx is disposed and a new
 * one with the same `ctx-name` is created). This lets consumers re-adopt
 * across a remount without losing their bindings. It also fires with `null`
 * when the container for that `ctxName` is disposed — consumers must release
 * the container, not just ignore the notification, so they don't outlive the
 * ctx they were reading from.
 */
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
        log.warn(`a whenAvailable consumer for ctx-name="${ctxName}" threw`, err);
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
    container.ctxName = ctxName; // informational, for logging attribution
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
      // it. Guard `=== container` in case a re-entrant `dispose()` already
      // removed it. Best-effort dispose, then rethrow.
      if (this._map.get(ctxName) === container) {
        this._map.delete(ctxName);
      }
      container.dispose();
      throw err;
    }
    // Notify `whenAvailable` subscribers AFTER the eager init.
    this._notifyConsumers(ctxName, container);
    return container;
  }

  /** Tear down the ctx's container: null-notify consumers (so they release before the controllers are destroyed), then dispose. */
  public dispose(ctxName: string): void {
    const container = this._map.get(ctxName);
    if (!container) {
      return;
    }
    this._map.delete(ctxName);
    this._notifyConsumers(ctxName, null);
    container.dispose();
  }

  public get(ctxName: string): ControllerContainer | undefined {
    return this._map.get(ctxName);
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
