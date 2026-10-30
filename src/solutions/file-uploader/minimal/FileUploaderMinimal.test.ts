import { afterEach, describe, expect, it, vi } from 'vitest';
import { ACTIVITY_TYPES } from '../../../abstract/activity-constants';
import { CollectionStateController } from '../../../abstract/controllers/CollectionStateController';
import { ConfigController } from '../../../abstract/controllers/ConfigController';
import { RouterController } from '../../../abstract/controllers/RouterController';
import type { Uid } from '../../../abstract/Uid';
import { UploaderRegistry } from '../../../abstract/UploaderRegistry';
import { ensureUploaderCtx } from '../../../lit/ensureUploaderCtx';
import { delay } from '../../../utils/delay';
import { FileUploaderMinimal } from './FileUploaderMinimal';

// Idempotent (same path as defineComponents(UC)).
FileUploaderMinimal.reg('uc-file-uploader-minimal');

let seq = 0;
const mounted: HTMLElement[] = [];
const ctxNames: string[] = [];

const freshCtxName = (): string => {
  const name = `fu-minimal-spec-${seq++}`;
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
): Promise<{ el: FileUploaderMinimal; config: ConfigController; router: RouterController }> => {
  ensureUploaderCtx(ctxName);
  const container = UploaderRegistry.get(ctxName);
  const config = container?.get(ConfigController);
  const router = container?.get(RouterController);
  if (!config || !router) throw new Error('controllers not resolved');
  const el = document.createElement('uc-file-uploader-minimal') as FileUploaderMinimal;
  el.setAttribute('ctx-name', ctxName);
  document.body.append(el);
  mounted.push(el);
  await el.updateComplete;
  await delay(0);
  return { el, config, router };
};

const settle = async (el: FileUploaderMinimal): Promise<void> => {
  await el.updateComplete;
  await delay(0);
};

// The inline drop-area is the first `<uc-drop-area>` in the persistent
// `<uc-start-from>` (the modal picker's drop-area is second).
const inlineDropArea = (el: FileUploaderMinimal): Element | null => el.querySelector('uc-start-from uc-drop-area');

describe('FileUploaderMinimal', () => {
  it('composes a compact upload list (chrome=compact) and dual start-from trees', async () => {
    const ctxName = freshCtxName();
    const { el } = await mount(ctxName);
    const list = el.querySelector('uc-upload-list');
    expect(list).not.toBeNull();
    expect(list?.getAttribute('chrome')).toBe('compact');
    // Persistent trigger + modal picker (two start-from activity mounts).
    expect(el.querySelectorAll('uc-start-from')).toHaveLength(2);
    expect(el.querySelector('uc-modal#start-from')).not.toBeNull();
  });

  it('drives the background slot off CollectionStateController.uploadList only when the list reference changes (per-key dedup)', async () => {
    const ctxName = freshCtxName();
    const { el, router } = await mount(ctxName);
    const collectionState = UploaderRegistry.get(ctxName)?.get(CollectionStateController);
    if (!collectionState) throw new Error('collection state not resolved');

    // Spy AFTER mount (the eager init-fire already ran). The migrated sub
    // sources `uploadList` from `CollectionStateController` with an `Object.is`
    // per-key guard, reproducing the old `*uploadList` `bag.ctx` sub — so a
    // coarse collection-state notify that leaves `uploadList` untouched must NOT
    // re-invoke `setActivity`, while a real list-reference change must.
    const setActivity = vi.spyOn(router, 'setActivity');

    // Unrelated key change → uploadList reference identical → no re-drive.
    collectionState.set('commonProgress', 0.5);
    await settle(el);
    expect(setActivity).not.toHaveBeenCalled();

    // New uploadList reference with entries → drives to the upload list.
    collectionState.set('uploadList', ['a' as Uid]);
    await settle(el);
    expect(setActivity).toHaveBeenCalledWith(ACTIVITY_TYPES.UPLOAD_LIST);

    // Emptying it (new reference) → drives back to start-from.
    setActivity.mockClear();
    collectionState.set('uploadList', []);
    await settle(el);
    expect(setActivity).toHaveBeenCalledWith(ACTIVITY_TYPES.START_FROM);

    setActivity.mockRestore();
  });

  it('routes upload-list to the background and everything else to the foreground', async () => {
    const ctxName = freshCtxName();
    const { router } = await mount(ctxName);
    expect(router.navigationStrategy(ACTIVITY_TYPES.UPLOAD_LIST)).toBe('background');
    expect(router.navigationStrategy(ACTIVITY_TYPES.START_FROM)).toBe('foreground');
    expect(router.doneActivity).toBe(ACTIVITY_TYPES.UPLOAD_LIST);
  });

  it('forces confirmUpload off', async () => {
    const ctxName = freshCtxName();
    const { el, config } = await mount(ctxName);
    expect(config.get('confirmUpload')).toBe(false);
    // A later external attempt to turn it on is corrected back to false.
    config.set('confirmUpload', true);
    await settle(el);
    expect(config.get('confirmUpload')).toBe(false);
  });

  it('reactively mirrors filesViewMode into the host [mode] attribute (getTracked, no subConfigValue)', async () => {
    const ctxName = freshCtxName();
    const { el, config } = await mount(ctxName);
    expect(el.getAttribute('mode')).toBe(config.get('filesViewMode'));

    config.set('filesViewMode', 'grid');
    await settle(el);
    expect(el.getAttribute('mode')).toBe('grid');

    config.set('filesViewMode', 'list');
    await settle(el);
    expect(el.getAttribute('mode')).toBe('list');
  });

  it('reactively toggles the host [single-grid] attr (one-column --uc-grid-col) and the drop-area [single] attr for grid + non-multiple', async () => {
    const ctxName = freshCtxName();
    const { el, config } = await mount(ctxName);
    config.set('filesViewMode', 'grid');
    config.set('multiple', false);
    await settle(el);
    expect(el.hasAttribute('single-grid')).toBe(true);
    expect(inlineDropArea(el)?.hasAttribute('single')).toBe(true);

    // Turning on multiple drops the single-column constraint.
    config.set('multiple', true);
    await settle(el);
    expect(el.hasAttribute('single-grid')).toBe(false);
    expect(inlineDropArea(el)?.hasAttribute('single')).toBe(false);

    // Leaving grid mode also drops it.
    config.set('multiple', false);
    config.set('filesViewMode', 'list');
    await settle(el);
    expect(el.hasAttribute('single-grid')).toBe(false);
    expect(inlineDropArea(el)?.hasAttribute('single')).toBe(false);
  });
});
