import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfigController } from '../../abstract/controllers/ConfigController';
import { RouterController } from '../../abstract/controllers/RouterController';
import { UploadCollectionController } from '../../abstract/controllers/UploadCollectionController';
import type { TypedData } from '../../abstract/TypedData';
import type { UploadEntryData } from '../../abstract/uploadEntrySchema';
import { ensureUploaderCtx } from '../../lit/ensureUploaderCtx';
import { PubSub } from '../../lit/PubSubCompat';
import type { Uid } from '../../lit/Uid';
import { delay } from '../../utils/delay';
import { CloudImageEditorActivity } from './CloudImageEditorActivity';

// Idempotent (same path as defineComponents(UC)).
CloudImageEditorActivity.reg('uc-cloud-image-editor-activity');

let seq = 0;
const mounted: HTMLElement[] = [];
const ctxNames: string[] = [];

const freshCtxName = (): string => {
  const name = `cloud-image-editor-activity-spec-${seq++}`;
  ctxNames.push(name);
  return name;
};

afterEach(() => {
  vi.restoreAllMocks();
  for (const el of mounted.splice(0)) el.remove();
  for (const name of ctxNames.splice(0)) {
    if (PubSub.hasCtx(name)) PubSub.deleteCtx(name);
  }
});

type FakeEntry = {
  setMultipleValues: ReturnType<typeof vi.fn>;
};

// Minimal `UploadCollectionController` fake: `read(uid)` returns an entry whose
// `getValue('cdnUrl')` resolves so `_mountEditor` sets `_cdnUrl`. Absent a
// `cdnUrl` (or absent the whole collection) the block's
// `whenController(UploadCollectionController)` observer leaves `_cdnUrl` null and
// nothing renders — matching the v1 mount gate.
const makeFakeCollection = (entriesById: Record<string, { cdnUrl?: string } & FakeEntry>): UploadCollectionController =>
  ({
    read: (uid: Uid) => {
      const entry = entriesById[uid as string];
      if (!entry) return undefined;
      return {
        getValue: (key: string) => (key === 'cdnUrl' ? entry.cdnUrl : undefined),
        setMultipleValues: entry.setMultipleValues,
      } as unknown as TypedData<UploadEntryData>;
    },
  }) as unknown as UploadCollectionController;

const mount = async (
  ctxName: string,
  opts: {
    internalId?: string;
    entries?: Record<string, { cdnUrl?: string } & FakeEntry>;
  } = {},
): Promise<{ el: CloudImageEditorActivity; config: ConfigController; router: RouterController }> => {
  ensureUploaderCtx(ctxName);
  const container = PubSub.getContainer(ctxName);
  const ctx = PubSub.getCtx(ctxName);
  const config = container?.get(ConfigController);
  const router = container?.get(RouterController);
  if (!container || !ctx || !config || !router) throw new Error('controllers not resolved');

  // Router params carry the `internalId` `_mountEditor` reads on adoption, so set
  // them before the element adopts.
  if (opts.internalId) {
    router.setActivity('cloud-image-edit', { internalId: opts.internalId });
  }
  if (opts.entries) {
    // M-god step 9b-2: the block reads the collection via
    // `whenController(UploadCollectionController)` off the container (was
    // `bag.when('uploadCollection')`). Bind + resolve it on the container
    // (mirrors `ensureUploaderScope`) so the `whenController` waiter fires.
    const collection = makeFakeCollection(opts.entries);
    container.bind(UploadCollectionController, () => collection);
    container.get(UploadCollectionController);
  }

  const el = document.createElement('uc-cloud-image-editor-activity') as CloudImageEditorActivity;
  el.setAttribute('ctx-name', ctxName);
  document.body.append(el);
  mounted.push(el);
  await el.updateComplete;
  await delay(0);
  return { el, config, router };
};

const editorEl = (el: CloudImageEditorActivity): HTMLElement | null => el.querySelector('uc-cloud-image-editor');

describe('CloudImageEditorActivity (M-god step 6b-9 migration)', () => {
  it('declares its dependencies via static uses (incl. the base RouterController)', () => {
    expect(CloudImageEditorActivity.uses).toEqual([RouterController, ConfigController]);
  });

  it('pre-warms its declared dependencies into the container on adoption', async () => {
    const ctxName = freshCtxName();
    await mount(ctxName);
    const container = PubSub.getContainer(ctxName);
    expect(container?.get(RouterController)).toBeInstanceOf(RouterController);
    expect(container?.get(ConfigController)).toBeInstanceOf(ConfigController);
  });

  it('renders nothing until the uploadCollection entry (with a cdnUrl) resolves', async () => {
    const ctxName = freshCtxName();
    // Router params present, but no uploadCollection resolved on the container ->
    // `whenController` never fires, `_cdnUrl` stays null, nothing renders.
    const { el } = await mount(ctxName, { internalId: 'file-1' });
    expect(editorEl(el)).toBeNull();
  });

  it('mounts the <uc-cloud-image-editor> with the entry cdn-url once the collection resolves', async () => {
    const ctxName = freshCtxName();
    const { el } = await mount(ctxName, {
      internalId: 'file-1',
      entries: { 'file-1': { cdnUrl: 'https://cdn.test/file-1/', setMultipleValues: vi.fn() } },
    });
    const editor = editorEl(el);
    expect(editor).not.toBeNull();
    expect(editor?.getAttribute('cdn-url')).toBe('https://cdn.test/file-1/');
  });

  it('feeds cropPreset / cloudImageEditorTabs to the editor and re-renders reactively (getTracked)', async () => {
    const ctxName = freshCtxName();
    const { el, config } = await mount(ctxName, {
      internalId: 'file-1',
      entries: { 'file-1': { cdnUrl: 'https://cdn.test/file-1/', setMultipleValues: vi.fn() } },
    });
    config.set('cropPreset', '1:1');
    config.set('cloudImageEditorTabs', 'crop,tuning');
    await el.updateComplete;
    await delay(0);
    expect(editorEl(el)?.getAttribute('crop-preset')).toBe('1:1');
    expect(editorEl(el)?.getAttribute('tabs')).toBe('crop,tuning');

    // A later config change re-renders the mounted editor with new attributes —
    // the tracked read replaces the v1 `subConfigValue` subscriptions.
    config.set('cropPreset', '16:9');
    await el.updateComplete;
    await delay(0);
    expect(editorEl(el)?.getAttribute('crop-preset')).toBe('16:9');
  });

  it('applies the editor result to the entry and traverses onBack on the "apply" event', async () => {
    const ctxName = freshCtxName();
    const setMultipleValues = vi.fn();
    const { el, router } = await mount(ctxName, {
      internalId: 'file-1',
      entries: { 'file-1': { cdnUrl: 'https://cdn.test/file-1/', setMultipleValues } },
    });
    const traverse = vi.spyOn(router, 'traverse');
    const editor = editorEl(el);
    expect(editor).not.toBeNull();

    editor?.dispatchEvent(
      new CustomEvent('apply', {
        detail: { cdnUrl: 'https://cdn.test/file-1/-/edited/', cdnUrlModifiers: '-/edited/' },
      }),
    );

    expect(setMultipleValues).toHaveBeenCalledWith({
      cdnUrl: 'https://cdn.test/file-1/-/edited/',
      cdnUrlModifiers: '-/edited/',
    });
    expect(traverse).toHaveBeenCalledWith('onBack');
  });

  it('traverses onBack on the "cancel" event (via the RouterController)', async () => {
    const ctxName = freshCtxName();
    const { el, router } = await mount(ctxName, {
      internalId: 'file-1',
      entries: { 'file-1': { cdnUrl: 'https://cdn.test/file-1/', setMultipleValues: vi.fn() } },
    });
    const traverse = vi.spyOn(router, 'traverse');
    editorEl(el)?.dispatchEvent(new CustomEvent('cancel', { detail: {} }));
    expect(traverse).toHaveBeenCalledWith('onBack');

    // A non-CustomEvent (`detail` undefined branch) still navigates back.
    traverse.mockClear();
    editorEl(el)?.dispatchEvent(new Event('cancel'));
    expect(traverse).toHaveBeenCalledWith('onBack');
  });

  it('debug-prints the "change" event without side-effects (editor stays mounted)', async () => {
    const ctxName = freshCtxName();
    const { el, router } = await mount(ctxName, {
      internalId: 'file-1',
      entries: { 'file-1': { cdnUrl: 'https://cdn.test/file-1/', setMultipleValues: vi.fn() } },
    });
    const traverse = vi.spyOn(router, 'traverse');
    editorEl(el)?.dispatchEvent(new CustomEvent('change', { detail: { cdnUrlModifiers: '-/x/' } }));
    // `handleChange` only debug-prints — no navigation, editor untouched.
    expect(traverse).not.toHaveBeenCalled();
    expect(editorEl(el)).not.toBeNull();
  });

  it('ignores the "apply" event when there is no resolved entry', async () => {
    const ctxName = freshCtxName();
    const setMultipleValues = vi.fn();
    const { el, router } = await mount(ctxName, {
      internalId: 'file-1',
      entries: { 'file-1': { cdnUrl: 'https://cdn.test/file-1/', setMultipleValues } },
    });
    const editor = editorEl(el);
    const traverse = vi.spyOn(router, 'traverse');
    // Simulate the (post-teardown) race where the entry is gone but a queued
    // editor event still lands: `_handleApply` must early-return.
    (el as unknown as { _entry: undefined })._entry = undefined;
    editor?.dispatchEvent(
      new CustomEvent('apply', { detail: { cdnUrl: 'https://cdn.test/x/', cdnUrlModifiers: '-/x/' } }),
    );
    expect(setMultipleValues).not.toHaveBeenCalled();
    expect(traverse).not.toHaveBeenCalled();
  });

  it('does not mount the editor when the entry is missing from the collection', async () => {
    const ctxName = freshCtxName();
    // Collection registered but `read('file-1')` returns undefined -> the mount
    // observer throws (isolated by `controllerReady`), leaving nothing rendered.
    const { el } = await mount(ctxName, { internalId: 'file-1', entries: {} });
    expect(editorEl(el)).toBeNull();
  });

  it('does not mount the editor when the entry has not uploaded yet (no cdnUrl)', async () => {
    const ctxName = freshCtxName();
    const { el } = await mount(ctxName, {
      internalId: 'file-1',
      entries: { 'file-1': { setMultipleValues: vi.fn() } },
    });
    expect(editorEl(el)).toBeNull();
  });
});
