import type { UploadcareGroup } from '@uploadcare/upload-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CollectionStateController } from '../../abstract/controllers/CollectionStateController';
import { ConfigController } from '../../abstract/controllers/ConfigController';
import { RouterController } from '../../abstract/controllers/RouterController';
import { UploadCollectionController } from '../../abstract/controllers/UploadCollectionController';
import { TelemetryManager } from '../../abstract/managers/TelemetryManager';
import { UploaderPublicApi } from '../../abstract/UploaderPublicApi';
import { ensureUploaderCtx } from '../../lit/ensureUploaderCtx';
import { PubSub } from '../../lit/PubSubCompat';
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
// the block reads them via `use()`, so the fakes must live on the container, not
// the `*publicApi`/`*uploadCollection` ctx keys). `*uploadCollection` is still
// ctx-seeded too, for the `bag.when('uploadCollection')` observer. The migrated
// reactive reads under test (uploadList / collectionErrors / filesViewMode)
// don't touch these fakes.
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

const makeFakeCollection = (): { collection: UploadCollectionController; clearAll: ReturnType<typeof vi.fn> } => {
  const clearAll = vi.fn();
  const noop = () => () => {};
  const collection = {
    clearAll,
    size: 0,
    observeProperties: noop,
    observeCollection: noop,
    hasItem: () => false,
  } as unknown as UploadCollectionController;
  return { collection, clearAll };
};

const mount = async (
  ctxName: string,
  opts: { state?: Partial<OutputCollectionState>; config?: Partial<ConfigType> } = {},
): Promise<{
  el: UploadList;
  config: ConfigController;
  collectionState: CollectionStateController;
  router: RouterController;
  telemetry: TelemetryManager;
  spies: ApiSpies;
  clearAll: ReturnType<typeof vi.fn>;
}> => {
  ensureUploaderCtx(ctxName);
  const container = PubSub.getContainer(ctxName);
  const ctx = PubSub.getCtx(ctxName);
  const config = container?.get(ConfigController);
  const collectionState = container?.get(CollectionStateController);
  const router = container?.get(RouterController);
  const telemetry = container?.get(TelemetryManager);
  if (!container || !ctx || !config || !collectionState || !router || !telemetry)
    throw new Error('controllers not resolved');
  // Config must be applied before the element adopts (the leading throttled tick
  // in `controllerReady` reads it), so set it up front.
  for (const [k, v] of Object.entries(opts.config ?? {})) {
    config.set(k as keyof ConfigType, v as ConfigType[keyof ConfigType]);
  }
  const { api, spies } = makeFakeApi(zeroCollectionState(opts.state));
  const { collection, clearAll } = makeFakeCollection();
  // Bind the fakes on the container (the block reads them via `use()`), and seed
  // `*uploadCollection` in the ctx store for the `bag.when` observer path.
  container.bind(UploaderPublicApi, () => api);
  container.bind(UploadCollectionController, () => collection);
  ctx.add('*uploadCollection', collection, true);
  const el = document.createElement('uc-upload-list') as UploadList;
  el.setAttribute('ctx-name', ctxName);
  document.body.append(el);
  mounted.push(el);
  await el.updateComplete;
  await delay(0);
  return { el, config, collectionState, router, telemetry, spies, clearAll };
};

afterEach(() => {
  vi.restoreAllMocks();
  for (const el of mounted.splice(0)) el.remove();
  for (const name of ctxNames.splice(0)) {
    if (PubSub.hasCtx(name)) PubSub.deleteCtx(name);
  }
});

describe('UploadList (M-god step 6b-8 migration)', () => {
  it('declares its dependencies via static uses (incl. the base RouterController)', () => {
    expect(UploadList.uses).toEqual([
      ConfigController,
      CollectionStateController,
      RouterController,
      TelemetryManager,
      UploaderPublicApi,
      UploadCollectionController,
    ]);
  });

  it('re-renders the <uc-file-item> list reactively when uploadList changes (getTracked, no ctx.sub)', async () => {
    const ctxName = freshCtxName();
    const { el, collectionState } = await mount(ctxName);

    expect(el.querySelectorAll('uc-file-item')).toHaveLength(0);

    collectionState.set('uploadList', [{ uid: 'file-1' as Uid }, { uid: 'file-2' as Uid }]);
    await el.updateComplete;
    await delay(0);
    expect(el.querySelectorAll('uc-file-item')).toHaveLength(2);

    collectionState.set('uploadList', [{ uid: 'file-1' as Uid }]);
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
      state: { totalCount: 2 },
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
      state: { totalCount: 1, successCount: 1 },
    });

    const doneBtn = el.querySelector<HTMLButtonElement>('button.uc-done-btn');
    expect(doneBtn?.hasAttribute('hidden')).toBe(false);
    expect(doneBtn?.hasAttribute('disabled')).toBe(false);

    doneBtn?.click();
    expect(spies.getOutputCollectionState).toHaveBeenCalled();
    expect(spies.doneFlow).toHaveBeenCalledOnce();
  });

  it.each([
    ['uploading', { totalCount: 1, uploadingCount: 1 }],
    ['failed', { totalCount: 1, failedCount: 1 }],
    ['succeed', { totalCount: 1, successCount: 1 }],
    ['total', { totalCount: 1 }],
  ] as const)('derives a non-empty localized header for the %s state', async (_label, state) => {
    const ctxName = freshCtxName();
    const { el } = await mount(ctxName, { state });
    expect(el.querySelector('.uc-header-text')?.textContent?.trim()).not.toBe('');
  });

  it('registers a router guard that blocks entering an empty upload-list and reacts to group info', async () => {
    const ctxName = freshCtxName();
    const { el, router, collectionState } = await mount(ctxName);

    // Guard predicate: empty collection (fake size 0) + default showEmptyList=false
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
});
