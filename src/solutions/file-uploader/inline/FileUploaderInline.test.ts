import { afterEach, describe, expect, it } from 'vitest';
import { CollectionStateController } from '../../../abstract/controllers/CollectionStateController';
import { ConfigController } from '../../../abstract/controllers/ConfigController';
import { RouterController } from '../../../abstract/controllers/RouterController';
import { TelemetryManager } from '../../../abstract/managers/TelemetryManager';
import { UploaderRegistry } from '../../../abstract/UploaderRegistry';
import { ensureUploaderCtx } from '../../../lit/ensureUploaderCtx';
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
    UploaderRegistry.dispose(name);
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
  const container = UploaderRegistry.get(ctxName);
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
  it('resolves its dependencies via @inject fields on the element', async () => {
    const ctxName = freshCtxName();
    const { el, config, router, collection } = await mount(ctxName);
    const container = UploaderRegistry.get(ctxName);
    // Always-bound controllers become `@inject` fields resolving through the
    // container the block adopted (tagged as `this[CONTAINER]`) — the mechanism
    // that replaces `static uses` + `this.use()`.
    const injected = el as unknown as {
      _router: RouterController;
      _config: ConfigController;
      _collectionState: CollectionStateController;
      _telemetry: TelemetryManager;
    };
    expect(injected._router).toBe(router);
    expect(injected._config).toBe(config);
    expect(injected._collectionState).toBe(collection);
    expect(injected._telemetry).toBe(container?.get(TelemetryManager));
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

  it('recomputes cancel-button visibility for showEmptyList only on a router notify (v1 stale-by-design)', async () => {
    const ctxName = freshCtxName();
    const { el, config, router } = await mount(ctxName);
    expect(cancelBtn(el)?.hidden).toBe(true);

    // v1 read `showEmptyList` imperatively INSIDE the `subRouter` recompute, not
    // reactively in `render()`. So flipping the config alone does NOT re-show the
    // button — `_couldCancel` (`@state`) is rewritten only on a router notify.
    // Asserting the config flip is a no-op here locks in that stale-by-design v1
    // semantics; do NOT "fix" this into a reactive tracked config read (that was
    // the M-god step 6b-4 regression this test now guards against).
    config.set('showEmptyList', true);
    await settle(el);
    expect(cancelBtn(el)?.hidden).toBe(true);

    // A router notify (a same-activity `setActivity`, which still notifies) runs
    // the recompute, which now reads the true `showEmptyList` → button revealed.
    router.setActivity('start-from');
    await settle(el);
    expect(cancelBtn(el)?.hidden).toBe(false);

    // Same asymmetry the other way: config flip is stale until the next notify.
    config.set('showEmptyList', false);
    await settle(el);
    expect(cancelBtn(el)?.hidden).toBe(false);
    router.setActivity('start-from');
    await settle(el);
    expect(cancelBtn(el)?.hidden).toBe(true);
  });

  it('reveals the cancel button when the upload list becomes non-empty, and keeps it visible when it empties (router-notify driven, v1 parity)', async () => {
    const ctxName = freshCtxName();
    const { el, collection } = await mount(ctxName);
    expect(cancelBtn(el)?.hidden).toBe(true);

    // A non-empty list drives a navigation to `upload-list` (the `*uploadList`
    // sub), and THAT router notify runs the recompute (history-back is now
    // available) → button visible. Visibility is router-notify driven, not a
    // reactive read of the list.
    collection.set('uploadList', ['file-1' as Uid]);
    await settle(el);
    expect(cancelBtn(el)?.hidden).toBe(false);

    // Emptying the list again keeps the button visible (v1 parity): the empty
    // transition is a no-op in the `*uploadList` sub (no `setActivity`), so no
    // router notify fires and `_couldCancel` retains its previously-computed
    // visible value — stale-by-design, exactly as v1's `subRouter`-only recompute.
    collection.set('uploadList', []);
    await settle(el);
    expect(cancelBtn(el)?.hidden).toBe(false);
  });

  it('keeps the cancel button visible when the list empties after a forced start-from (v1 stale-by-design)', async () => {
    const ctxName = freshCtxName();
    const { el, collection, router } = await mount(ctxName);
    // A non-empty list navigates to `upload-list` (router notify → visible).
    collection.set('uploadList', ['file-1' as Uid]);
    await settle(el);
    expect(cancelBtn(el)?.hidden).toBe(false);
    // Force back to start-from: this is the LAST router notify, and the list is
    // still non-empty here, so the recompute leaves `_couldCancel` visible.
    router.setActivity('start-from');
    await settle(el);
    expect(cancelBtn(el)?.hidden).toBe(false);
    // Now empty the list. The `*uploadList` sub is a no-op on the empty
    // transition (no `setActivity`), so NO router notify fires and `_couldCancel`
    // is NOT recomputed — it retains the previously-computed VISIBLE value.
    //
    // This is the exact v1 behavior the M-god step 6b-4 migration accidentally
    // changed: it had made `_couldCancel` a reactive tracked read that re-hid the
    // button here (flipping the inline `:has(.uc-cancel-btn[hidden])` layout).
    // The migration contract is behavior-preservation — v1 keeps it visible, so
    // we assert visible. A later, separate change may fix this genuine v1 quirk.
    collection.set('uploadList', []);
    await settle(el);
    expect(cancelBtn(el)?.hidden).toBe(false);
  });
});
