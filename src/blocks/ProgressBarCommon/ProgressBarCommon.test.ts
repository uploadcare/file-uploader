import { afterEach, describe, expect, it, vi } from 'vitest';
import { CollectionStateController } from '../../abstract/controllers/CollectionStateController';
import { UploadCollectionController } from '../../abstract/controllers/UploadCollectionController';
import { UploaderRegistry } from '../../abstract/UploaderRegistry';
import { ensureUploaderCtx } from '../../lit/ensureUploaderCtx';
import { delay } from '../../utils/delay';
import type { ProgressBar } from '../ProgressBar/ProgressBar';
import { ProgressBarCommon } from './ProgressBarCommon';

// Idempotent (same path as defineComponents(UC)).
ProgressBarCommon.reg('uc-progress-bar-common');

let seq = 0;
const mounted: HTMLElement[] = [];
const ctxNames: string[] = [];

const freshCtxName = (): string => {
  const name = `progress-bar-common-spec-${seq++}`;
  ctxNames.push(name);
  return name;
};

afterEach(() => {
  for (const el of mounted.splice(0)) el.remove();
  for (const name of ctxNames.splice(0)) {
    UploaderRegistry.dispose(name);
  }
});

const mount = async (
  ctxName: string,
): Promise<{ el: ProgressBarCommon; collectionState: CollectionStateController }> => {
  ensureUploaderCtx(ctxName);
  const collectionState = UploaderRegistry.get(ctxName)?.get(CollectionStateController);
  if (!collectionState) throw new Error('collection-state controller not resolved');
  const el = document.createElement('uc-progress-bar-common') as ProgressBarCommon;
  el.setAttribute('ctx-name', ctxName);
  document.body.append(el);
  mounted.push(el);
  await el.updateComplete;
  return { el, collectionState };
};

const innerValue = (el: ProgressBarCommon): number | undefined =>
  (el.querySelector('uc-progress-bar') as ProgressBar | null)?.value;

describe('ProgressBarCommon (M-god step 6b-2 migration)', () => {
  it('resolves its CollectionStateController dependency via the @inject field on the element', async () => {
    const ctxName = freshCtxName();
    const { el, collectionState } = await mount(ctxName);
    // The `@inject(CollectionStateController)` field resolves through the
    // container the block adopted (tagged as `this[CONTAINER]`), yielding the
    // same controller instance the ctx owns — the mechanism that replaces
    // `static uses` + `this.use()`.
    expect((el as unknown as { _collectionState: CollectionStateController })._collectionState).toBe(collectionState);
  });

  it('re-renders the inner progress-bar value reactively when commonProgress changes (getTracked, no ctx.sub)', async () => {
    const ctxName = freshCtxName();
    const { el, collectionState } = await mount(ctxName);
    expect(innerValue(el)).toBe(0);

    // External collection-state change — no imperative `ctx.sub('*commonProgress')`
    // on the block. The tracked `commonProgress` read in render() re-renders.
    collectionState.set('commonProgress', 42);
    await el.updateComplete;
    await delay(0);
    expect(innerValue(el)).toBe(42);

    collectionState.set('commonProgress', 100);
    await el.updateComplete;
    await delay(0);
    expect(innerValue(el)).toBe(100);
  });

  it('registers a collection property observer via whenController once the UploadCollectionController resolves, and tears it down on disconnect', async () => {
    const ctxName = freshCtxName();
    ensureUploaderCtx(ctxName);
    const container = UploaderRegistry.get(ctxName);
    if (!container) throw new Error('container not resolved');

    const unobserveProperties = vi.fn();
    const unobserveCollection = vi.fn();
    const observeProperties = vi.fn(() => unobserveProperties);
    const observeCollection = vi.fn(() => unobserveCollection);
    const collection = {
      observeProperties,
      observeCollection,
      items: () => [],
      read: () => null,
    } as unknown as UploadCollectionController;
    container.bind(UploadCollectionController, () => collection);

    const el = document.createElement('uc-progress-bar-common') as ProgressBarCommon;
    el.setAttribute('ctx-name', ctxName);
    document.body.append(el);
    mounted.push(el);
    await el.updateComplete;

    // whenController is pending — UploadCollectionController is bound but not resolved.
    expect(observeProperties).not.toHaveBeenCalled();
    expect(observeCollection).not.toHaveBeenCalled();

    // Resolving it (mirrors `ensureUploaderScope`) flushes the waiter, registering
    // both the property and collection-membership observers.
    container.get(UploadCollectionController);
    expect(observeProperties).toHaveBeenCalledOnce();
    expect(observeCollection).toHaveBeenCalledOnce();

    // Disconnect tears both tracked observer subscriptions down.
    el.remove();
    expect(unobserveProperties).toHaveBeenCalledOnce();
    expect(unobserveCollection).toHaveBeenCalledOnce();
  });

  it('sets initial visibility for an already-populated (uploading) collection at wire time, without waiting for a property/collection change', async () => {
    const ctxName = freshCtxName();
    ensureUploaderCtx(ctxName);
    const container = UploaderRegistry.get(ctxName);
    if (!container) throw new Error('container not resolved');

    const collection = {
      observeProperties: vi.fn(() => vi.fn()),
      observeCollection: vi.fn(() => vi.fn()),
      items: () => ['a'],
      read: () => ({ get: () => true }),
    } as unknown as UploadCollectionController;
    container.bind(UploadCollectionController, () => collection);
    container.get(UploadCollectionController); // resolve eagerly (simulates an already-populated scope)

    const el = document.createElement('uc-progress-bar-common') as ProgressBarCommon;
    el.setAttribute('ctx-name', ctxName);
    document.body.append(el);
    mounted.push(el);
    await el.updateComplete;

    const bar = el.querySelector('uc-progress-bar') as ProgressBar | null;
    expect(bar?.visible).toBe(true);
  });

  it('recomputes visibility on collection membership change (observeCollection), not just property change', async () => {
    const ctxName = freshCtxName();
    ensureUploaderCtx(ctxName);
    const container = UploaderRegistry.get(ctxName);
    if (!container) throw new Error('container not resolved');

    let uploading = true;
    let collectionHandler: (() => void) | undefined;
    const collection = {
      observeProperties: vi.fn(() => vi.fn()),
      observeCollection: vi.fn((handler: () => void) => {
        collectionHandler = handler;
        return vi.fn();
      }),
      items: () => (uploading ? ['a'] : []),
      read: () => ({ get: () => uploading }),
    } as unknown as UploadCollectionController;
    container.bind(UploadCollectionController, () => collection);

    const el = document.createElement('uc-progress-bar-common') as ProgressBarCommon;
    el.setAttribute('ctx-name', ctxName);
    document.body.append(el);
    mounted.push(el);
    await el.updateComplete;

    container.get(UploadCollectionController); // flush whenController waiter
    await el.updateComplete;

    const bar = () => el.querySelector('uc-progress-bar') as ProgressBar | null;
    expect(bar()?.visible).toBe(true);

    // Simulate the last upload being removed entirely (e.g. `remove()`/`abort()`):
    // this fires ONLY the collection observer, never a property one.
    uploading = false;
    collectionHandler?.();
    await el.updateComplete;

    expect(bar()?.visible).toBe(false);
  });
});
