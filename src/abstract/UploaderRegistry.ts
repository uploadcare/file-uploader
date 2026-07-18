import type { ControllerContainer } from './di/ControllerContainer';

/**
 * Global registry of uploader scopes keyed by `ctx-name`. Children that
 * live outside the uploader's DOM subtree resolve their per-ctx DI
 * `ControllerContainer` through this registry (the cross-DOM equivalent of
 * `@lit/context`) and pull the controllers they need off it.
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

  public register(ctxName: string, container: ControllerContainer): void {
    const existing = this._map.get(ctxName);
    if (existing && existing !== container) {
      // Common case: the previous owning element disconnected and its
      // deferred unregister hasn't fired yet. The new element takes over; the
      // deferred unregister becomes a no-op (it checks identity before
      // deleting).
      console.warn(
        `[uc] Replacing the container registered under ctx-name="${ctxName}". If two uploaders share this name simultaneously the second one wins.`,
      );
    }
    this._map.set(ctxName, container);
    // Notify every subscriber for this ctxName so they re-adopt the new
    // container.
    const set = this._consumers.get(ctxName);
    if (set) {
      // Isolate each consumer: a single throwing callback must not abort
      // notification of the others or bubble out of `register()`. Snapshot
      // first — a consumer's callback may synchronously subscribe/unsubscribe
      // (mutating `set`) during notification.
      for (const sub of [...set]) {
        try {
          sub.cb(container);
        } catch (err) {
          console.warn(`[uc] a whenAvailable consumer for ctx-name="${ctxName}" threw`, err);
        }
      }
    }
  }

  public unregister(ctxName: string, container: ControllerContainer): void {
    if (this._map.get(ctxName) !== container) {
      // Stale unregister (e.g. deferred from a disconnected element already
      // replaced by a new registration) — the current owner is unaffected.
      return;
    }
    this._map.delete(ctxName);
    const set = this._consumers.get(ctxName);
    if (set) {
      // Isolate each consumer: a single throwing callback must not abort
      // notification of the others or bubble out of `unregister()`. Snapshot
      // first — a consumer's callback may synchronously subscribe/unsubscribe
      // (mutating `set`) during notification.
      for (const sub of [...set]) {
        try {
          sub.cb(null);
        } catch (err) {
          console.warn(`[uc] a whenAvailable consumer for ctx-name="${ctxName}" threw`, err);
        }
      }
    }
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
