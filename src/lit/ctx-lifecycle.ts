import { UploaderRegistry } from '../abstract/UploaderRegistry';

/**
 * Consumer-refcount teardown predicate: a ctx is dead — nothing left
 * referencing it — when its `ControllerContainer` has no consumers
 * (`container.isUnreferenced()`). A ctx with no container at all is likewise
 * unreferenced.
 *
 * A `ChildBlock` registers as a container consumer on controller adoption
 * (`container.addConsumer`) and drops it on release, so the container is the
 * single owner of both the controllers and the consumer set.
 * `ChildBlock.disconnectedCallback` schedules a deferred (`setTimeout(0)`) call
 * to this predicate before running `destroyCtx`, so a still-connected consumer
 * keeps the ctx alive.
 */
export function isCtxUnreferenced(ctxName: string): boolean {
  const container = UploaderRegistry.get(ctxName);
  return container ? container.isUnreferenced() : true;
}

/**
 * The single ctx teardown path, used by `ChildBlock` once `isCtxUnreferenced`
 * reports the ctx dead. Disposes the ctx's `ControllerContainer` (null-notify
 * consumers so they release BEFORE the controllers are destroyed, then dispose
 * in reverse insertion order) via `UploaderRegistry.dispose` — the sole
 * container-owner of the per-ctx instance lifecycle.
 */
export function destroyCtx(ctxName: string): void {
  UploaderRegistry.dispose(ctxName);
}
