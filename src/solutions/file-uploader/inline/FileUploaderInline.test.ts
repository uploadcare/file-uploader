import { afterEach, describe, expect, it } from 'vitest';
import { CollectionStateController } from '../../../abstract/controllers/CollectionStateController';
import { ConfigController } from '../../../abstract/controllers/ConfigController';
import { RouterController } from '../../../abstract/controllers/RouterController';
import { TelemetryManager } from '../../../abstract/managers/TelemetryManager';
import { ensureUploaderCtx } from '../../../lit/ensureUploaderCtx';
import { PubSub } from '../../../lit/PubSubCompat';
import type { Uid } from '../../../lit/Uid';
import { delay } from '../../../utils/delay';
import { FileUploaderInline } from './FileUploaderInline';

// Idempotent (same path as defineComponents(UC)).
FileUploaderInline.reg('uc-file-uploader-inline');

let seq = 0;
const mounted: HTMLElement[] = [];
const ctxNames: string[] = [];

const freshCtxName = (): string => {
  const name = `fu-inline-spec-${seq++}`;
  ctxNames.push(name);
  return name;
};

afterEach(() => {
  for (const el of mounted.splice(0)) el.remove();
  for (const name of ctxNames.splice(0)) {
    if (PubSub.hasCtx(name)) PubSub.deleteCtx(name);
  }
});

const mount = async (
  ctxName: string,
): Promise<{
  el: FileUploaderInline;
  config: ConfigController;
  router: RouterController;
  collection: CollectionStateController;
}> => {
  ensureUploaderCtx(ctxName);
  const container = PubSub.getContainer(ctxName);
  const config = container?.get(ConfigController);
  const router = container?.get(RouterController);
  const collection = container?.get(CollectionStateController);
  if (!config || !router || !collection) throw new Error('controllers not resolved');
  const el = document.createElement('uc-file-uploader-inline') as FileUploaderInline;
  el.setAttribute('ctx-name', ctxName);
  document.body.append(el);
  mounted.push(el);
  await el.updateComplete;
  await delay(0);
  return { el, config, router, collection };
};

const settle = async (el: FileUploaderInline): Promise<void> => {
  await el.updateComplete;
  await delay(0);
};

const cancelBtn = (el: FileUploaderInline): HTMLButtonElement | null => el.querySelector('button.uc-cancel-btn');

describe('FileUploaderInline (M-god step 6b-4 migration)', () => {
  it('declares its dependencies via static uses', () => {
    expect(FileUploaderInline.uses).toEqual([
      RouterController,
      ConfigController,
      CollectionStateController,
      TelemetryManager,
    ]);
  });

  it('routes every activity to the background slot', async () => {
    const ctxName = freshCtxName();
    const { router } = await mount(ctxName);
    expect(router.navigationStrategy('start-from')).toBe('background');
    expect(router.navigationStrategy('upload-list')).toBe('background');
  });

  it('hides the cancel button initially (empty list, no history to go back to)', async () => {
    const ctxName = freshCtxName();
    const { el } = await mount(ctxName);
    expect(cancelBtn(el)?.hidden).toBe(true);
  });

  it('reveals the cancel button reactively when showEmptyList flips on (config getTracked)', async () => {
    const ctxName = freshCtxName();
    const { el, config } = await mount(ctxName);
    expect(cancelBtn(el)?.hidden).toBe(true);

    config.set('showEmptyList', true);
    await settle(el);
    expect(cancelBtn(el)?.hidden).toBe(false);

    config.set('showEmptyList', false);
    await settle(el);
    expect(cancelBtn(el)?.hidden).toBe(true);
  });

  it('reveals the cancel button reactively when the upload list becomes non-empty (collectionState getTracked)', async () => {
    const ctxName = freshCtxName();
    const { el, collection } = await mount(ctxName);
    expect(cancelBtn(el)?.hidden).toBe(true);

    collection.set('uploadList', [{ uid: 'file-1' as Uid }]);
    await settle(el);
    expect(cancelBtn(el)?.hidden).toBe(false);

    // Emptying the list again keeps the button visible: the non-empty list drove
    // a navigation to `upload-list`, so history-back is now available (v1 parity —
    // the v1 `*uploadList` sub was a no-op on the empty transition and retained
    // the previously-computed visible state; the tracked read recomputes to the
    // same result via `_couldHistoryBack`).
    collection.set('uploadList', []);
    await settle(el);
    expect(cancelBtn(el)?.hidden).toBe(false);
  });

  it('hides the cancel button when the list empties with no back-history (guarded revalidate path)', async () => {
    const ctxName = freshCtxName();
    const { el, collection, router } = await mount(ctxName);
    // Stay on start-from (no navigation), so there is no back-history; a list
    // that grows then empties leaves the cancel button hidden.
    collection.set('uploadList', [{ uid: 'file-1' as Uid }]);
    await settle(el);
    // Force back to start-from so history has nothing below the top.
    router.setActivity('start-from');
    collection.set('uploadList', []);
    await settle(el);
    expect(cancelBtn(el)?.hidden).toBe(true);
  });
});
