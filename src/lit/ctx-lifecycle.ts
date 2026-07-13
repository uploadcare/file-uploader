import { UploaderRegistry } from '../abstract/UploaderRegistry';
import { PubSub } from './PubSubCompat';
import type { SharedState } from './SharedState';
import { controllerOwnedInstanceKeys, type ISharedInstance } from './shared-instances';

/**
 * Unified consumer-refcount teardown predicate (M9o Task 3). A ctx is dead
 * — nothing left referencing it — when BOTH halves of the composition have
 * released it:
 *
 * - v1: no `LitBlock` remains in `*blocksRegistry` (absent or empty, read
 *   straight off the ctx rather than any one element, since a v2-triggered
 *   check has no `LitBlock` instance to ask).
 * - v2: no `ChildBlock` is still watching it via `UploaderRegistry.
 *   whenAvailable` (`UploaderRegistry.hasConsumers`).
 *
 * Both `LitBlock.disconnectedCallback` and `ChildBlock.disconnectedCallback`
 * schedule a deferred (`setTimeout(0)`) call to this predicate before
 * running `destroyCtx` — so a still-connected consumer on either side keeps
 * the ctx alive regardless of which side's disconnect triggered the check.
 */
export function isCtxUnreferenced(ctxName: string): boolean {
  const ctx = PubSub.getCtx<SharedState>(ctxName);
  const blocksRegistry = ctx?.has('*blocksRegistry') ? ctx.read('*blocksRegistry') : undefined;
  const hasV1Blocks = !!blocksRegistry && blocksRegistry.size > 0;
  return !hasV1Blocks && !UploaderRegistry.hasConsumers(ctxName);
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
