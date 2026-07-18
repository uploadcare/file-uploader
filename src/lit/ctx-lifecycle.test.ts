import { afterEach, describe, expect, it, vi } from 'vitest';
import { destroyCtx, isCtxUnreferenced } from './ctx-lifecycle';
import { ensureUploaderCtx } from './ensureUploaderCtx';
import { PubSub } from './PubSubCompat';
import type { SharedState } from './SharedState';

// Each test uses a unique ctx id and tears it down so the module-level
// context/controller maps and the global UploaderRegistry don't leak.
let seq = 0;
const ids: string[] = [];
const freshCtxName = () => {
  const id = `ctx-lifecycle-test-${seq++}`;
  ids.push(id);
  return id;
};

afterEach(() => {
  for (const id of ids.splice(0)) {
    if (PubSub.hasCtx(id)) PubSub.deleteCtx(id);
  }
});

describe('isCtxUnreferenced', () => {
  it('is true for a ctx-name that has never existed', () => {
    const ctxName = freshCtxName();
    expect(PubSub.hasCtx(ctxName)).toBe(false);
    expect(isCtxUnreferenced(ctxName)).toBe(true);
  });

  it('is true when the ctx exists as a bare map with no container', () => {
    const ctxName = freshCtxName();
    // A raw `registerCtx` (no config/controller touch) has no ControllerContainer,
    // so the predicate reports it unreferenced.
    PubSub.registerCtx<SharedState>({} as SharedState, ctxName);
    expect(PubSub.getContainer(ctxName)).toBeNull();
    expect(isCtxUnreferenced(ctxName)).toBe(true);
  });

  it('is true when the ctx has a container but no consumers', () => {
    const ctxName = freshCtxName();
    ensureUploaderCtx(ctxName); // creates the per-ctx ControllerContainer
    expect(PubSub.getContainer(ctxName)).not.toBeNull();
    expect(isCtxUnreferenced(ctxName)).toBe(true);
  });

  it('is false while a container consumer is registered, true after it is removed (M-god step 6a)', () => {
    // The refcount moved from UploaderRegistry.whenAvailable to the per-ctx
    // ControllerContainer: a ChildBlock is a container consumer for the span of
    // its controller adoption, and this predicate reads container.isUnreferenced().
    const ctxName = freshCtxName();
    ensureUploaderCtx(ctxName);
    const container = PubSub.getContainer(ctxName);
    expect(container).not.toBeNull();
    const consumer = {};
    container?.addConsumer(consumer);
    expect(isCtxUnreferenced(ctxName)).toBe(false);
    container?.removeConsumer(consumer);
    expect(isCtxUnreferenced(ctxName)).toBe(true);
  });
});

describe('destroyCtx', () => {
  it('deletes the ctx (PubSub.hasCtx becomes false)', () => {
    const ctxName = freshCtxName();
    PubSub.registerCtx<SharedState>({} as SharedState, ctxName);
    expect(PubSub.hasCtx(ctxName)).toBe(true);

    destroyCtx(ctxName);

    expect(PubSub.hasCtx(ctxName)).toBe(false);
  });

  it('is a no-op (does not throw) when the ctx does not exist', () => {
    const ctxName = freshCtxName();
    expect(PubSub.hasCtx(ctxName)).toBe(false);
    expect(() => destroyCtx(ctxName)).not.toThrow();
  });

  it('destroys a non-controller-owned *sharedContextInstances entry and pub-nulls the key, then clears the map', () => {
    const ctxName = freshCtxName();
    const ctx = PubSub.registerCtx<SharedState>({} as SharedState, ctxName);
    const destroySpy = vi.fn();
    // '*publicApi' is not in `controllerOwnedInstanceKeys`, so `destroyCtx` must
    // call `.destroy()` on it directly, then pub-null the key. (This test used
    // `*pluginManager` until M-god step 8c graduated it to controller-owned; see
    // the dedicated skip-test below.)
    const instance = { destroy: destroySpy };
    const instances = new Map<string, { destroy: () => void }>([['*publicApi', instance]]);
    ctx.add('*sharedContextInstances', instances as unknown as SharedState['*sharedContextInstances'], true);
    ctx.add('*publicApi', instance as unknown as SharedState['*publicApi'], true);

    destroyCtx(ctxName);

    expect(destroySpy).toHaveBeenCalledTimes(1);
  });

  it('does NOT call .destroy() directly on a controller-owned instance key (the container disposes it, via PubSub.deleteCtx)', () => {
    const ctxName = freshCtxName();
    const ctx = PubSub.registerCtx<SharedState>({} as SharedState, ctxName);
    const destroySpy = vi.fn();
    // '*a11y' IS in `controllerOwnedInstanceKeys` — `destroyCtx` must skip
    // calling `.destroy()` on it directly (still pub-nulling the key), same
    // as v1's `_destroySharedContextInstances`.
    const instance = { destroy: destroySpy };
    const instances = new Map<string, { destroy: () => void }>([['*a11y', instance]]);
    ctx.add('*sharedContextInstances', instances as unknown as SharedState['*sharedContextInstances'], true);
    ctx.add('*a11y', instance as unknown as SharedState['*a11y'], true);

    destroyCtx(ctxName);

    expect(destroySpy).not.toHaveBeenCalled();
  });

  it('skips .destroy() on *pluginManager (controller-owned since M-god step 8c — the container disposes it)', () => {
    const ctxName = freshCtxName();
    const ctx = PubSub.registerCtx<SharedState>({} as SharedState, ctxName);
    const destroySpy = vi.fn();
    // '*pluginManager' joined `controllerOwnedInstanceKeys` in M-god step 8c:
    // `ensurePluginManager` binds + resolves it on the per-ctx container, so
    // `container.dispose()` owns its teardown. `destroyCtx` must skip its direct
    // `.destroy()` (still pub-nulling the key) to avoid a double-destroy.
    const instance = { destroy: destroySpy };
    const instances = new Map<string, { destroy: () => void }>([['*pluginManager', instance]]);
    ctx.add('*sharedContextInstances', instances as unknown as SharedState['*sharedContextInstances'], true);
    ctx.add('*pluginManager', instance as unknown as SharedState['*pluginManager'], true);

    destroyCtx(ctxName);

    expect(destroySpy).not.toHaveBeenCalled();
  });
});
