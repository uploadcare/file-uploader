import type { UploaderController } from '../abstract/controllers/UploaderController';

/**
 * Global registry of `<uc-uploader>` instances keyed by `ctx-name`. Children
 * outside the uploader's DOM subtree resolve their controller through this
 * registry.
 *
 * The lookup is reactive — `whenAvailable(ctxName, cb)` fires synchronously
 * if a controller is already registered, immediately when one registers, and
 * AGAIN whenever the registration changes (e.g. the owning element is
 * removed and a new one with the same `ctx-name` is rendered). This lets
 * consumers (`ChildBlock`, `TrayLifecycleController`) re-adopt across a
 * remount without losing their event/state bindings.
 */
class UploaderRegistryImpl {
  private _map = new Map<string, UploaderController>();
  private _consumers = new Map<string, Set<(c: UploaderController) => void>>();

  public register(ctxName: string, controller: UploaderController): void {
    const existing = this._map.get(ctxName);
    if (existing && existing !== controller) {
      // Common case: the previous owning element disconnected and its
      // `setTimeout(0)` unregister hasn't fired yet. The new element
      // takes over; the deferred unregister becomes a no-op (it checks
      // identity before deleting).
      console.warn(
        `[uc] Replacing the controller registered under ctx-name="${ctxName}". If two uploaders share this name simultaneously the second one wins.`,
      );
    }
    this._map.set(ctxName, controller);
    // Notify every subscriber for this ctxName so they re-adopt the new
    // controller. `_adoptController` short-circuits if the controller is
    // already the same, so subscribers that registered after the initial
    // call don't spuriously rebind.
    const set = this._consumers.get(ctxName);
    if (set) {
      for (const cb of set) cb(controller);
    }
  }

  public unregister(ctxName: string, controller: UploaderController): void {
    if (this._map.get(ctxName) === controller) {
      this._map.delete(ctxName);
    }
  }

  public get(ctxName: string): UploaderController | undefined {
    return this._map.get(ctxName);
  }

  /**
   * Subscribe to the controller under `ctxName`. Fires synchronously with
   * the current controller (if registered), then fires again each time a
   * new controller registers under the same name. Returns an unsubscribe.
   */
  public whenAvailable(ctxName: string, cb: (c: UploaderController) => void): () => void {
    let set = this._consumers.get(ctxName);
    if (!set) {
      set = new Set();
      this._consumers.set(ctxName, set);
    }
    set.add(cb);
    const existing = this._map.get(ctxName);
    if (existing) cb(existing);
    return () => {
      set?.delete(cb);
    };
  }
}

export const UploaderRegistry = new UploaderRegistryImpl();
