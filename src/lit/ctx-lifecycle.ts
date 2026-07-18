import { PubSub } from './PubSubCompat';
import type { SharedState } from './SharedState';
import { controllerOwnedInstanceKeys, type ISharedInstance } from './shared-instances';

/**
 * Consumer-refcount teardown predicate: a ctx is dead — nothing left
 * referencing it — when its `ControllerContainer` has no consumers
 * (`container.isUnreferenced()`). A ctx with no container at all (a bare
 * `registerCtx` never touched by a controller/config) is likewise unreferenced.
 *
 * M-god step 6a retargeted this from `UploaderRegistry.hasConsumers` to the
 * container: a `ChildBlock` now registers as a container consumer on controller
 * adoption (`container.addConsumer`) and drops it on release, so the container
 * is the single owner of both the controllers and the consumer set. Because
 * `UploaderRegistry.whenAvailable` fires synchronously once `ensureUploaderCtx`
 * has forced the controller into existence, adopt/release happen at the same
 * instant the registry subscription used to be the refcount — teardown timing is
 * preserved. (The v1 `*blocksRegistry` half was removed with the v1 element
 * layer in M11 — no `LitBlock` populates it anymore.)
 *
 * `ChildBlock.disconnectedCallback` schedules a deferred (`setTimeout(0)`)
 * call to this predicate before running `destroyCtx`, so a still-connected
 * consumer keeps the ctx alive.
 */
export function isCtxUnreferenced(ctxName: string): boolean {
  const container = PubSub.getContainer(ctxName);
  return container ? container.isUnreferenced() : true;
}

/**
 * The single ctx teardown path (M9o Task 3), used by both `LitBlock` and
 * `ChildBlock` once `isCtxUnreferenced` reports the ctx dead — so teardown
 * is byte-identical regardless of which base triggered it.
 *
 * Mirrors what `LitBlock.destroyCtxCallback` always did
 * (`_destroySharedContextInstances` + `PubSub.deleteCtx`), but reads
 * `*sharedContextInstances` straight off the ctx's own store rather than off
 * an element's `$` proxy — the map is ctx-scoped state (added via
 * `this.add(key, map, true)`, which writes through to the ctx's nanostores
 * store), not element-instance-scoped, so it's reachable with no live
 * `LitBlock` around at all (the exact case a v2-only, v1-free ctx needs).
 *
 * `PubSub.deleteCtx`'s own ordering (ctx delete -> unregister null-notify ->
 * controller.destroy) is untouched — this function only replaces *how* the
 * DOM-layer pub-null pass is reached, not what `deleteCtx` does or when.
 */
export function destroyCtx(ctxName: string): void {
  const ctx = PubSub.getCtx<SharedState>(ctxName);
  if (ctx) {
    const key = '*sharedContextInstances';
    const instances: Map<string, ISharedInstance> | undefined = ctx.has(key) ? ctx.read(key) : undefined;
    if (instances) {
      for (const [instanceKey, instance] of instances.entries()) {
        // Controller-owned instances (M9k+) are destroyed by
        // `UploaderController.destroy()`, which `PubSub.deleteCtx` (below)
        // triggers right after this loop — destroying them here too would
        // tear them down while the ctx is still up. Still pub-null them,
        // same as every other key.
        if (!controllerOwnedInstanceKeys.has(instanceKey as keyof SharedState)) {
          instance?.destroy?.();
        }
        ctx.pub(instanceKey as keyof SharedState, null as never);
      }
      instances.clear();
    }
  }
  PubSub.deleteCtx(ctxName);
}
