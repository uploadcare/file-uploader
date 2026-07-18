import { afterEach, describe, expect, it, vi } from 'vitest';
import { TelemetryManager } from '../abstract/managers/TelemetryManager';
import { UploaderRegistry } from '../abstract/UploaderRegistry';
import { destroyCtx, isCtxUnreferenced } from './ctx-lifecycle';
import { ensureUploaderCtx } from './ensureUploaderCtx';

// Each test uses a unique ctx id and tears it down so the global
// UploaderRegistry doesn't leak.
let seq = 0;
const ids: string[] = [];
const freshCtxName = () => {
  const id = `ctx-lifecycle-test-${seq++}`;
  ids.push(id);
  return id;
};

afterEach(() => {
  for (const id of ids.splice(0)) {
    UploaderRegistry.dispose(id);
  }
});

describe('isCtxUnreferenced', () => {
  it('is true for a ctx-name that has never existed', () => {
    const ctxName = freshCtxName();
    expect(UploaderRegistry.get(ctxName)).toBeUndefined();
    expect(isCtxUnreferenced(ctxName)).toBe(true);
  });

  it('is true when the ctx has a container but no consumers', () => {
    const ctxName = freshCtxName();
    ensureUploaderCtx(ctxName); // creates the per-ctx ControllerContainer
    expect(UploaderRegistry.get(ctxName)).toBeDefined();
    expect(isCtxUnreferenced(ctxName)).toBe(true);
  });

  it('is false while a container consumer is registered, true after it is removed (M-god step 6a)', () => {
    // The refcount lives on the per-ctx ControllerContainer: a ChildBlock is a
    // container consumer for the span of its controller adoption, and this
    // predicate reads container.isUnreferenced().
    const ctxName = freshCtxName();
    ensureUploaderCtx(ctxName);
    const container = UploaderRegistry.get(ctxName);
    expect(container).toBeDefined();
    const consumer = {};
    container?.addConsumer(consumer);
    expect(isCtxUnreferenced(ctxName)).toBe(false);
    container?.removeConsumer(consumer);
    expect(isCtxUnreferenced(ctxName)).toBe(true);
  });
});

describe('destroyCtx', () => {
  it('disposes the ctx container (UploaderRegistry.get becomes undefined)', () => {
    const ctxName = freshCtxName();
    ensureUploaderCtx(ctxName);
    expect(UploaderRegistry.get(ctxName)).toBeDefined();

    destroyCtx(ctxName);

    expect(UploaderRegistry.get(ctxName)).toBeUndefined();
  });

  it('is a no-op (does not throw) when the ctx does not exist', () => {
    const ctxName = freshCtxName();
    expect(UploaderRegistry.get(ctxName)).toBeUndefined();
    expect(() => destroyCtx(ctxName)).not.toThrow();
  });

  it('destroys the container-owned controllers exactly once (the container owns disposal)', () => {
    const ctxName = freshCtxName();
    const container = ensureUploaderCtx(ctxName);
    // TelemetryManager is eagerly resolved at ctx creation, so the container
    // owns its disposal. `destroyCtx` → `container.dispose()` must call its
    // `destroy()` exactly once (no separate teardown pass double-destroys it).
    const destroySpy = vi.spyOn(container.get(TelemetryManager), 'destroy');

    destroyCtx(ctxName);

    expect(destroySpy).toHaveBeenCalledTimes(1);
  });
});
