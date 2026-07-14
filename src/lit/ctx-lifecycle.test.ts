import { afterEach, describe, expect, it, vi } from 'vitest';
import { UploaderRegistry } from '../abstract/UploaderRegistry';
import { destroyCtx, isCtxUnreferenced } from './ctx-lifecycle';
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

  it('is true when the ctx exists but *blocksRegistry is absent and there are no whenAvailable consumers', () => {
    const ctxName = freshCtxName();
    PubSub.registerCtx<SharedState>({} as SharedState, ctxName);
    expect(isCtxUnreferenced(ctxName)).toBe(true);
  });

  it('is false while *blocksRegistry holds at least one entry', () => {
    const ctxName = freshCtxName();
    const ctx = PubSub.registerCtx<SharedState>({} as SharedState, ctxName);
    ctx.add('*blocksRegistry', new Set([{}]) as unknown as SharedState['*blocksRegistry'], true);
    expect(isCtxUnreferenced(ctxName)).toBe(false);
  });

  it('is true when *blocksRegistry is present but empty and there are no consumers', () => {
    const ctxName = freshCtxName();
    const ctx = PubSub.registerCtx<SharedState>({} as SharedState, ctxName);
    ctx.add('*blocksRegistry', new Set() as unknown as SharedState['*blocksRegistry'], true);
    expect(isCtxUnreferenced(ctxName)).toBe(true);
  });

  it('is false while a UploaderRegistry whenAvailable consumer is watching, even with no *blocksRegistry at all', () => {
    const ctxName = freshCtxName();
    const off = UploaderRegistry.whenAvailable(ctxName, vi.fn());
    expect(isCtxUnreferenced(ctxName)).toBe(false);
    off();
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
    // '*pluginManager' is not in `controllerOwnedInstanceKeys` (it's DOM-layer
    // owned, per `shared-instances.ts`), so `destroyCtx` must call `.destroy()`
    // on it directly, then pub-null the key.
    const instance = { destroy: destroySpy };
    const instances = new Map<string, { destroy: () => void }>([['*pluginManager', instance]]);
    ctx.add('*sharedContextInstances', instances as unknown as SharedState['*sharedContextInstances'], true);
    ctx.add('*pluginManager', instance as unknown as SharedState['*pluginManager'], true);

    destroyCtx(ctxName);

    expect(destroySpy).toHaveBeenCalledTimes(1);
  });

  it('does NOT call .destroy() directly on a controller-owned instance key (UploaderController.destroy owns that, via PubSub.deleteCtx)', () => {
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
});
