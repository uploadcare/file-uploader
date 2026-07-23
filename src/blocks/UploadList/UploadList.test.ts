import type { UploadcareGroup } from '@uploadcare/upload-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CollectionStateController } from '../../abstract/controllers/CollectionStateController';
import { ConfigController } from '../../abstract/controllers/ConfigController';
import { RouterController } from '../../abstract/controllers/RouterController';
import { UploadCollectionController } from '../../abstract/controllers/UploadCollectionController';
import { TelemetryManager } from '../../abstract/managers/TelemetryManager';
import { UploaderPublicApi } from '../../abstract/UploaderPublicApi';
import { UploaderRegistry } from '../../abstract/UploaderRegistry';
import type { UploadEntryData } from '../../abstract/uploadEntrySchema';
import { ensureUploaderCtx } from '../../lit/ensureUploaderCtx';
import type { Uid } from '../../lit/Uid';
import type { ConfigType, OutputCollectionState } from '../../types';
import { delay } from '../../utils/delay';
import { UploadList } from './UploadList';

// Idempotent (same path as defineComponents(UC)).
UploadList.reg('uc-upload-list');

let seq = 0;
const mounted: HTMLElement[] = [];
const ctxNames: string[] = [];

const freshCtxName = (): string => {
  const name = `upload-list-spec-${seq++}`;
  ctxNames.push(name);
  return name;
};

// `UploadList.controllerReady` fires `_updateUploadsState` (via the leading-edge
// throttled collection-update tick that `subConfigValue('multiple')` triggers
// immediately), which reads `use(UploaderPublicApi).getOutputCollectionState()`,
// and wires `bag.when('uploadCollection')` observers. `UploaderPublicApi` and
// `UploadCollectionController` are container-owned but in production carry a live
// upload stack; in a bare unit ctx they'd construct real instances with no
// backing state — so `container.bind` a minimal fake for each (M-god step 8d:
// the block reads them via `use()`, so the fakes must live on the container).
// The migrated reactive reads under test (uploadList / collectionErrors /
// filesViewMode) don't touch these fakes.
type ApiSpies = {
  getOutputCollectionState: ReturnType<typeof vi.fn>;
  uploadAll: ReturnType<typeof vi.fn>;
  initFlow: ReturnType<typeof vi.fn>;
  doneFlow: ReturnType<typeof vi.fn>;
};

const zeroCollectionState = (over: Partial<OutputCollectionState> = {}): OutputCollectionState =>
  ({
    totalCount: 0,
    successCount: 0,
    failedCount: 0,
    uploadingCount: 0,
    idleEntries: [],
    allEntries: [],
    errors: [],
    group: null,
    ...over,
  }) as unknown as OutputCollectionState;

const makeFakeApi = (state: OutputCollectionState): { api: UploaderPublicApi; spies: ApiSpies } => {
  const spies: ApiSpies = {
    getOutputCollectionState: vi.fn(() => state),
    // The leading throttled tick auto-uploads when `confirmUpload` is off.
    uploadAll: vi.fn(),
    initFlow: vi.fn(),
    doneFlow: vi.fn(),
  };
  return { api: spies as unknown as UploaderPublicApi, spies };
};

const mount = async (
  ctxName: string,
  opts: {
    entries?: Partial<UploadEntryData>[];
    collectionErrors?: { type: string; message: string }[];
    config?: Partial<ConfigType>;
    chrome?: UploadList['chrome'];
  } = {},
): Promise<{
  el: UploadList;
  config: ConfigController;
  collectionState: CollectionStateController;
  collection: UploadCollectionController;
  router: RouterController;
  telemetry: TelemetryManager;
  spies: ApiSpies;
  clearAll: ReturnType<typeof vi.spyOn>;
}> => {
  ensureUploaderCtx(ctxName);
  const container = UploaderRegistry.get(ctxName);
  const config = container?.get(ConfigController);
  const collectionState = container?.get(CollectionStateController);
  const router = container?.get(RouterController);
  const telemetry = container?.get(TelemetryManager);
  // The toolbar summary is a raw single-pass count over the REAL collection now,
  // so use the real controller + real entries (not a fake) to drive it.
  const collection = container?.get(UploadCollectionController);
  if (!container || !config || !collectionState || !router || !telemetry || !collection) {
    throw new Error('controllers not resolved');
  }
  // Config must be applied before the element adopts (the leading throttled tick
  // in `controllerReady` reads it), so set it up front.
  for (const [k, v] of Object.entries(opts.config ?? {})) {
    config.set(k as keyof ConfigType, v as ConfigType[keyof ConfigType]);
  }
  for (const init of opts.entries ?? []) {
    collection.add(init);
  }
  if (opts.collectionErrors) {
    collectionState.set('collectionErrors', opts.collectionErrors as never);
  }
  // Fake api only for the action methods (`uploadAll`/`initFlow`/`doneFlow`) and
  // the `_handleDone` DONE_CLICK payload — `_updateUploadsState` no longer reads it.
  const { api, spies } = makeFakeApi(zeroCollectionState());
  container.bind(UploaderPublicApi, () => api);
  const clearAll = vi.spyOn(collection, 'clearAll');
  const el = document.createElement('uc-upload-list') as UploadList;
  el.setAttribute('ctx-name', ctxName);
  if (opts.chrome) {
    el.chrome = opts.chrome;
  }
  document.body.append(el);
  mounted.push(el);
  await el.updateComplete;
  await delay(0);
  return { el, config, collectionState, collection, router, telemetry, spies, clearAll };
};

afterEach(() => {
  vi.restoreAllMocks();
  for (const el of mounted.splice(0)) el.remove();
  for (const name of ctxNames.splice(0)) {
    UploaderRegistry.dispose(name);
  }
});

describe('UploadList (M-god step 6b-8 migration)', () => {
  it('resolves its always-bound dependencies via @inject fields (incl. the inherited RouterController)', async () => {
    const ctxName = freshCtxName();
    const { el, config, collectionState, router, telemetry } = await mount(ctxName);
    // Always-bound controllers become `@inject` fields; `RouterController` is the
    // inherited `ActivityChildBlock._router` field. The uploader-scope-bound
    // `UploaderPublicApi` / `UploadCollectionController` (read via
    // `use()`/`useOrNull`/`whenController`) deliberately stay off `@inject`.
    const injected = el as unknown as {
      _config: ConfigController;
      _collectionState: CollectionStateController;
      _router: RouterController;
      _telemetry: TelemetryManager;
    };
    expect(injected._config).toBe(config);
    expect(injected._collectionState).toBe(collectionState);
    expect(injected._router).toBe(router);
    expect(injected._telemetry).toBe(telemetry);
  });

  it('re-renders the <uc-file-item> list reactively when uploadList changes (getTracked, no ctx.sub)', async () => {
    const ctxName = freshCtxName();
    const { el, collectionState } = await mount(ctxName);

    expect(el.querySelectorAll('uc-file-item')).toHaveLength(0);

    collectionState.set('uploadList', ['file-1' as Uid, 'file-2' as Uid]);
    await el.updateComplete;
    await delay(0);
    expect(el.querySelectorAll('uc-file-item')).toHaveLength(2);

    collectionState.set('uploadList', ['file-1' as Uid]);
    await el.updateComplete;
    await delay(0);
    expect(el.querySelectorAll('uc-file-item')).toHaveLength(1);

    collectionState.set('uploadList', []);
    await el.updateComplete;
    await delay(0);
    expect(el.querySelectorAll('uc-file-item')).toHaveLength(0);
  });

  it('shows/hides the common-error row reactively from collectionErrors (tracked getter)', async () => {
    const ctxName = freshCtxName();
    const { el, collectionState } = await mount(ctxName);
    const errorRow = () => el.querySelector<HTMLElement>('.uc-common-error');

    // No errors -> row hidden, no text.
    expect(errorRow()?.hasAttribute('hidden')).toBe(true);
    expect(errorRow()?.textContent?.trim()).toBe('');

    collectionState.set('collectionErrors', [{ type: 'TOO_MANY_FILES', message: 'too many files' }]);
    await el.updateComplete;
    await delay(0);
    expect(errorRow()?.hasAttribute('hidden')).toBe(false);
    expect(errorRow()?.textContent?.trim()).toBe('too many files');

    // Per-file marker errors are ignored — the row stays for real collection errors only.
    collectionState.set('collectionErrors', [{ type: 'SOME_FILES_HAS_ERRORS', message: 'ignored' }]);
    await el.updateComplete;
    await delay(0);
    expect(errorRow()?.hasAttribute('hidden')).toBe(true);
    expect(errorRow()?.textContent?.trim()).toBe('');
  });

  it('drives the host [mode] attribute reactively from the filesViewMode config (willUpdate + getTracked)', async () => {
    const ctxName = freshCtxName();
    const { el, config } = await mount(ctxName);

    // Default filesViewMode is 'list'.
    expect(el.getAttribute('mode')).toBe('list');

    config.set('filesViewMode', 'grid');
    await el.updateComplete;
    await delay(0);
    expect(el.getAttribute('mode')).toBe('grid');

    config.set('filesViewMode', 'list');
    await el.updateComplete;
    await delay(0);
    expect(el.getAttribute('mode')).toBe('list');
  });

  it('traverses onClose via the RouterController when the close button is clicked', async () => {
    const ctxName = freshCtxName();
    const { el, router } = await mount(ctxName);
    const traverse = vi.spyOn(router, 'traverse');
    const closeBtn = el.querySelector<HTMLButtonElement>('button.uc-close-btn');
    expect(closeBtn).not.toBeNull();
    closeBtn?.click();
    expect(traverse).toHaveBeenCalledWith('onClose');
  });

  it('add-more sends an action telemetry event (use(TelemetryManager)) and calls api.initFlow(true)', async () => {
    const ctxName = freshCtxName();
    const { el, telemetry, spies } = await mount(ctxName);
    const sendEvent = vi.spyOn(telemetry, 'sendEvent');
    const addBtn = el.querySelector<HTMLButtonElement>('button.uc-add-more-btn');
    expect(addBtn).not.toBeNull();
    addBtn?.click();
    expect(sendEvent).toHaveBeenCalledOnce();
    expect(spies.initFlow).toHaveBeenCalledWith(true);
  });

  it('clear-all sends an action telemetry event and clears the upload collection', async () => {
    const ctxName = freshCtxName();
    const { el, telemetry, clearAll } = await mount(ctxName);
    const sendEvent = vi.spyOn(telemetry, 'sendEvent');
    el.querySelector<HTMLButtonElement>('button.uc-cancel-btn')?.click();
    expect(sendEvent).toHaveBeenCalledOnce();
    expect(clearAll).toHaveBeenCalledOnce();
  });

  it('shows the upload button + hides empty state for a ready-to-upload collection with confirmUpload (derived @state)', async () => {
    const ctxName = freshCtxName();
    const { el, spies } = await mount(ctxName, {
      config: { confirmUpload: true },
      entries: [{}, {}], // two idle entries, ready to upload
    });

    const uploadBtn = el.querySelector<HTMLButtonElement>('button.uc-upload-btn');
    const doneBtn = el.querySelector<HTMLButtonElement>('button.uc-done-btn');
    const emptyState = el.querySelector<HTMLElement>('.uc-no-files');
    expect(uploadBtn?.hasAttribute('hidden')).toBe(false);
    expect(doneBtn?.hasAttribute('hidden')).toBe(true);
    expect(emptyState?.hasAttribute('hidden')).toBe(true);
    // Header text derives from the summary and is localized (non-empty).
    expect(el.querySelector('.uc-header-text')?.textContent?.trim()).not.toBe('');

    uploadBtn?.click();
    expect(spies.uploadAll).toHaveBeenCalled();
  });

  it('enables the done button for a fully-succeeded collection and calls doneFlow on click', async () => {
    const ctxName = freshCtxName();
    const { el, spies } = await mount(ctxName, {
      entries: [{ fileInfo: { uuid: 'srv' } as never }], // one succeeded entry
    });

    const doneBtn = el.querySelector<HTMLButtonElement>('button.uc-done-btn');
    expect(doneBtn?.hasAttribute('hidden')).toBe(false);
    expect(doneBtn?.hasAttribute('disabled')).toBe(false);

    doneBtn?.click();
    expect(spies.getOutputCollectionState).toHaveBeenCalled();
    expect(spies.doneFlow).toHaveBeenCalledOnce();
  });

  it('an idle entry pending validation blocks upload/done and reads as "uploading" in the header', async () => {
    const ctxName = freshCtxName();
    const { el } = await mount(ctxName, {
      config: { confirmUpload: true },
      entries: [{ isValidationPending: true }], // idle + validation pending
    });

    // validatingBeforeUploading=1 (idle+validation) and anyValidationPending=true,
    // so validationOk is false → no upload button, done disabled.
    expect(el.querySelector<HTMLButtonElement>('button.uc-upload-btn')?.hasAttribute('hidden')).toBe(true);
    const doneBtn = el.querySelector<HTMLButtonElement>('button.uc-done-btn');
    expect(doneBtn?.hasAttribute('disabled')).toBe(true);
    // The header folds validating-before-uploading into the "uploading" line.
    expect(el.querySelector('.uc-header-text')?.textContent?.trim()).not.toBe('');
  });

  it.each([
    ['uploading', [{ isUploading: true }]],
    ['failed', [{ errors: [{ type: 'x', message: 'boom' } as never] }]],
    ['succeed', [{ fileInfo: { uuid: 'srv' } as never }]],
    ['total', [{}]],
  ] as [
    string,
    Partial<UploadEntryData>[],
  ][])('derives a non-empty localized header for the %s state', async (_label, entries) => {
    const ctxName = freshCtxName();
    const { el } = await mount(ctxName, { entries });
    expect(el.querySelector('.uc-header-text')?.textContent?.trim()).not.toBe('');
  });

  it('registers a router guard that blocks entering an empty upload-list and reacts to group info', async () => {
    const ctxName = freshCtxName();
    const { el, router, collectionState } = await mount(ctxName);

    // Guard predicate: empty collection (real size 0) + default showEmptyList=false
    // -> the router refuses to make upload-list the active activity.
    router.setActivity('upload-list');
    expect(router.activity).not.toBe('upload-list');

    // The `*groupInfo` subscription re-runs the derived-state recompute; a
    // truthy group must not throw.
    collectionState.set('groupInfo', {} as unknown as UploadcareGroup);
    await el.updateComplete;
    await delay(0);
    expect(el.isConnected).toBe(true);
  });

  it('the groupInfo subscription fires the collection-update tick only when groupInfo changes, not on unrelated collection-state writes (per-key dedup)', async () => {
    const ctxName = freshCtxName();
    const { el, collectionState } = await mount(ctxName);

    // Replace the throttled tick with a spy; the groupInfo handler calls
    // `this._throttledHandleCollectionUpdate()` (read at call time), so this
    // observes exactly which collection-state changes reach it.
    const tick = vi.fn();
    (el as unknown as { _throttledHandleCollectionUpdate: () => void })._throttledHandleCollectionUpdate = tick;

    // Unrelated collection-state write -> the groupInfo handler is deduped
    // (`Object.is` over the coarse notify), so no collection-update tick fires.
    collectionState.set('commonProgress', 25);
    expect(tick).not.toHaveBeenCalled();

    // A truthy groupInfo change fires the tick once.
    collectionState.set('groupInfo', {} as unknown as UploadcareGroup);
    expect(tick).toHaveBeenCalledTimes(1);

    // Re-setting the SAME group reference is `Object.is`-equal -> no re-fire.
    const sameGroup = collectionState.get('groupInfo');
    collectionState.set('groupInfo', sameGroup);
    expect(tick).toHaveBeenCalledTimes(1);
  });

  describe('chrome variants', () => {
    it('default chrome reflects chrome="default" and renders full header + toolbar', async () => {
      const ctxName = freshCtxName();
      const { el } = await mount(ctxName);

      expect(el.chrome).toBe('default');
      expect(el.getAttribute('chrome')).toBe('default');
      expect(el.querySelector('uc-activity-header')).not.toBeNull();
      expect(el.querySelector('button.uc-close-btn')).not.toBeNull();
      expect(el.querySelector('button.uc-cancel-btn')).not.toBeNull();
      expect(el.querySelector('button.uc-upload-btn')).not.toBeNull();
      expect(el.querySelector('button.uc-done-btn')).not.toBeNull();
      expect(el.querySelectorAll('button.uc-add-more-btn').length).toBeGreaterThanOrEqual(1);
    });

    it('compact chrome omits header and non-add-more toolbar actions', async () => {
      const ctxName = freshCtxName();
      const { el } = await mount(ctxName, { chrome: 'compact' });

      expect(el.getAttribute('chrome')).toBe('compact');
      expect(el.querySelector('uc-activity-header')).toBeNull();
      expect(el.querySelector('button.uc-close-btn')).toBeNull();
      expect(el.querySelector('button.uc-cancel-btn')).toBeNull();
      expect(el.querySelector('button.uc-upload-btn')).toBeNull();
      expect(el.querySelector('button.uc-done-btn')).toBeNull();
      // Toolbar add-more still present (files-area add-more also exists).
      expect(el.querySelector('button.uc-add-more-btn')).not.toBeNull();
    });

    it('compact chrome still runs add-more → initFlow', async () => {
      const ctxName = freshCtxName();
      const { el, spies } = await mount(ctxName, { chrome: 'compact' });
      el.querySelector<HTMLButtonElement>('button.uc-add-more-btn')?.click();
      expect(spies.initFlow).toHaveBeenCalledWith(true);
    });
  });
});
