import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfigController } from '../../abstract/controllers/ConfigController';
import { UploadCollectionController } from '../../abstract/controllers/UploadCollectionController';
import { PluginController } from '../../abstract/managers/plugin';
import { TelemetryManager } from '../../abstract/managers/TelemetryManager';
import { UploaderRegistry } from '../../abstract/UploaderRegistry';
import type { UploadEntryData } from '../../abstract/uploadEntrySchema';
import { ensureUploaderCtx } from '../../lit/ensureUploaderCtx';
import type { Uid } from '../../lit/Uid';
import { delay } from '../../utils/delay';
import { FileItem } from './FileItem';

// Idempotent (same path as defineComponents(UC)).
FileItem.reg('uc-file-item');

// Narrow test-only accessor for the private IntersectionObserver render gate:
// happy-dom never fires `isIntersecting`, so `_pauseRender` stays true and the
// element never renders. Flipping it directly (it is a `@state`, so the write
// triggers an update) opens the gate the same way an on-screen file item would.
type RenderGate = { _pauseRender: boolean };
const openRenderGate = async (el: FileItem): Promise<void> => {
  (el as unknown as RenderGate)._pauseRender = false;
  await el.updateComplete;
  await delay(0);
};

let seq = 0;
const mounted: HTMLElement[] = [];
const ctxNames: string[] = [];

const freshCtxName = (): string => {
  const name = `file-item-spec-${seq++}`;
  ctxNames.push(name);
  return name;
};

afterEach(() => {
  for (const el of mounted.splice(0)) el.remove();
  for (const name of ctxNames.splice(0)) {
    UploaderRegistry.dispose(name);
  }
});

const mount = async (ctxName: string): Promise<{ el: FileItem; config: ConfigController }> => {
  ensureUploaderCtx(ctxName);
  const config = UploaderRegistry.get(ctxName)?.get(ConfigController);
  if (!config) throw new Error('config controller not resolved');
  const el = document.createElement('uc-file-item') as FileItem;
  el.setAttribute('ctx-name', ctxName);
  document.body.append(el);
  mounted.push(el);
  await el.updateComplete;
  return { el, config };
};

const fileNameHidden = (el: FileItem): boolean =>
  (el.querySelector('.uc-file-name') as HTMLElement | null)?.hasAttribute('hidden') ?? true;

// --- rendered-output readers (the S2 parity net keys off the DOM/props render
// commits, not the private @state/getters, so it holds across the refactor) ---
const inner = (el: FileItem): HTMLElement => el.querySelector('.uc-inner') as HTMLElement;
const thumb = (el: FileItem): HTMLElement & { badgeIcon: string } =>
  el.querySelector('uc-thumb') as HTMLElement & { badgeIcon: string };
type ActionButton = HTMLElement & {
  uploading: boolean;
  queued: boolean;
  hideRemove: boolean;
  progress: number;
  failed: boolean;
  success: boolean;
};
const actionButton = (el: FileItem): ActionButton => el.querySelector('uc-file-action-button') as ActionButton;
const fileNameText = (el: FileItem): string => el.querySelector('.uc-file-name')?.textContent ?? '';
const errorSpan = (el: FileItem): HTMLElement => el.querySelector('.uc-file-error') as HTMLElement;
const hintSpan = (el: FileItem): HTMLElement => el.querySelector('.uc-file-hint') as HTMLElement;

const getCollection = (ctxName: string): UploadCollectionController => {
  const collection = UploaderRegistry.get(ctxName)?.get(UploadCollectionController);
  if (!collection) throw new Error('collection controller not resolved');
  return collection;
};

// Add an entry, bind it to the item, and open the render gate so render() commits.
const bindEntry = async (
  el: FileItem,
  collection: UploadCollectionController,
  init: Partial<UploadEntryData>,
): Promise<Uid> => {
  const uid = collection.add(init);
  el.uid = uid;
  await openRenderGate(el);
  return uid;
};

describe('FileItem (M-god step 6b-6 migration)', () => {
  it('resolves its always-bound dependencies via @inject fields on the element', async () => {
    const ctxName = freshCtxName();
    const { el, config } = await mount(ctxName);
    const container = UploaderRegistry.get(ctxName);
    // Always-bound controllers become `@inject` fields resolving through the
    // container the block adopted (tagged as `this[CONTAINER]`); the
    // uploader-scope-bound `UploadCollectionController` / `UploaderPublicApi`
    // (read via `useOrNull`) and the conditionally-bound `PluginController`
    // (read via `whenController`) deliberately stay off `@inject`.
    const injected = el as unknown as {
      _config: ConfigController;
      _telemetry: TelemetryManager;
    };
    expect(injected._config).toBe(config);
    expect(injected._telemetry).toBe(container?.get(TelemetryManager));
  });

  it('reflects the config filesViewMode onto the host [mode] attribute and reacts to changes', async () => {
    const ctxName = freshCtxName();
    const { el, config } = await mount(ctxName);
    // Default config is list mode — the imperative subConfigValue side-effect sets
    // the host attribute eagerly on adoption (independent of the render gate).
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

  it('shows file names reactively via the tracked _showFileNames getter (no @state / subConfigValue mirror)', async () => {
    const ctxName = freshCtxName();
    const { el, config } = await mount(ctxName);
    await openRenderGate(el);

    // List mode always shows names.
    expect(fileNameHidden(el)).toBe(false);

    // Grid mode without gridShowFileNames hides them — a tracked config read in
    // render() re-renders the item with no imperative subscription.
    config.set('filesViewMode', 'grid');
    await el.updateComplete;
    await delay(0);
    expect(fileNameHidden(el)).toBe(true);

    // Toggling gridShowFileNames in grid mode re-renders too (the getter reads
    // that key via getTracked, so it is auto-tracked).
    config.set('gridShowFileNames', true);
    await el.updateComplete;
    await delay(0);
    expect(fileNameHidden(el)).toBe(false);

    config.set('gridShowFileNames', false);
    await el.updateComplete;
    await delay(0);
    expect(fileNameHidden(el)).toBe(true);
  });

  // (The former `uploadTrigger` self-upload + `_upload`-delegation tests were
  // removed: FileItem no longer uploads — `uploadAll` drives
  // `UploadController.uploadEntries` directly. See UploaderPublicApi /
  // UploadController specs.)

  it('single-focus: clicking an item focuses it and unfocuses the previously-focused one', async () => {
    const ctxName = freshCtxName();
    ensureUploaderCtx(ctxName);
    const a = await mount(ctxName);
    const b = await mount(ctxName);

    a.el.click();
    expect(a.el.hasAttribute('focused')).toBe(true);
    expect(b.el.hasAttribute('focused')).toBe(false);

    b.el.click();
    expect(b.el.hasAttribute('focused')).toBe(true);
    expect(a.el.hasAttribute('focused')).toBe(false); // previous focus dropped — O(1), no full sweep
  });

  it('wires the plugin manager via whenController once the PluginController resolves, and unsubscribes on disconnect', async () => {
    const ctxName = freshCtxName();
    ensureUploaderCtx(ctxName);
    const container = UploaderRegistry.get(ctxName);
    if (!container) throw new Error('container not resolved');

    const unsub = vi.fn();
    const onPluginsChange = vi.fn(() => unsub);
    const fakePluginManager = {
      onPluginsChange,
      snapshot: () => ({ fileActions: [], icons: [], activities: [] }),
    } as unknown as PluginController;
    container.bind(PluginController, () => fakePluginManager);

    const el = document.createElement('uc-file-item') as FileItem;
    el.setAttribute('ctx-name', ctxName);
    document.body.append(el);
    mounted.push(el);
    await el.updateComplete;

    // whenController is pending — PluginController is bound but not resolved.
    expect(onPluginsChange).not.toHaveBeenCalled();

    // Resolving it (mirrors `ensurePluginManager`) flushes the waiter, which
    // subscribes to plugin changes.
    container.get(PluginController);
    expect(onPluginsChange).toHaveBeenCalledOnce();

    // Disconnect tears the tracked subscription down.
    el.remove();
    expect(unsub).toHaveBeenCalledOnce();
  });
});

// Parity net for the entry-state → rendered-output mapping (`_calculateState`/
// `_handleState`/`_updateHintAndProgress` today; derived `getTracked` reads after
// S2). Asserts the DOM/child-props render commits, so it survives the refactor.
describe('FileItem entry-state rendering', () => {
  it('IDLE entry: no status flags, empty badge, zero progress, name shown', async () => {
    const ctxName = freshCtxName();
    const { el } = await mount(ctxName);
    await bindEntry(el, getCollection(ctxName), { fileName: 'photo.png' });

    expect(inner(el).hasAttribute('data-finished')).toBe(false);
    expect(inner(el).hasAttribute('data-failed')).toBe(false);
    expect(inner(el).hasAttribute('data-uploading')).toBe(false);
    expect(thumb(el).badgeIcon).toBe('');
    expect(fileNameText(el)).toBe('photo.png');
    expect(errorSpan(el).hasAttribute('hidden')).toBe(true);
    expect(hintSpan(el).hasAttribute('hidden')).toBe(true);

    const btn = actionButton(el);
    expect(btn.uploading).toBe(false);
    expect(btn.hideRemove).toBe(false);
    expect(btn.failed).toBe(false);
    expect(btn.success).toBe(false);
    expect(btn.progress).toBe(0);
  });

  it('FINISHED entry (fileInfo set): success flag + success badge', async () => {
    const ctxName = freshCtxName();
    const { el } = await mount(ctxName);
    await bindEntry(el, getCollection(ctxName), { fileName: 'photo.png', fileInfo: { uuid: 'srv' } as never });

    expect(inner(el).hasAttribute('data-finished')).toBe(true);
    expect(thumb(el).badgeIcon).toBe('badge-success');
    expect(actionButton(el).success).toBe(true);
  });

  it('FAILED entry (errors set): failed flag, error badge, error text shown', async () => {
    const ctxName = freshCtxName();
    const { el } = await mount(ctxName);
    await bindEntry(el, getCollection(ctxName), {
      fileName: 'photo.png',
      errors: [{ type: 'boom', message: 'It broke' } as never],
    });

    expect(inner(el).hasAttribute('data-failed')).toBe(true);
    expect(thumb(el).badgeIcon).toBe('badge-error');
    expect(actionButton(el).failed).toBe(true);
    expect(errorSpan(el).hasAttribute('hidden')).toBe(false);
    expect(errorSpan(el).textContent).toBe('It broke');
    expect(hintSpan(el).hasAttribute('hidden')).toBe(true);
  });

  it('UPLOADING entry: uploading flag, hidden remove, live progress, no badge', async () => {
    const ctxName = freshCtxName();
    const { el } = await mount(ctxName);
    await bindEntry(el, getCollection(ctxName), {
      fileName: 'photo.png',
      isUploading: true,
      uploadProgress: 0.42,
    });

    expect(inner(el).hasAttribute('data-uploading')).toBe(true);
    expect(thumb(el).badgeIcon).toBe('');
    const btn = actionButton(el);
    expect(btn.uploading).toBe(true);
    expect(btn.hideRemove).toBe(true);
    expect(btn.progress).toBe(0.42);
  });

  it('QUEUED-UPLOADING entry: remove hidden, progress NOT zeroed', async () => {
    const ctxName = freshCtxName();
    const { el } = await mount(ctxName);
    await bindEntry(el, getCollection(ctxName), {
      fileName: 'photo.png',
      isQueuedForUploading: true,
      uploadProgress: 0.3,
    });

    const btn = actionButton(el);
    expect(btn.hideRemove).toBe(true);
    expect(btn.uploading).toBe(false);
    expect(btn.queued).toBe(true); // surfaced as the indeterminate queued indicator
    expect(btn.progress).toBe(0.3);
  });

  it('is not marked queued while actively uploading', async () => {
    const ctxName = freshCtxName();
    const { el } = await mount(ctxName);
    await bindEntry(el, getCollection(ctxName), { fileName: 'photo.png', isUploading: true });
    expect(actionButton(el).queued).toBe(false);
  });

  it('VALIDATION-pending entry: progress zeroed even with uploadProgress set', async () => {
    const ctxName = freshCtxName();
    const { el } = await mount(ctxName);
    await bindEntry(el, getCollection(ctxName), {
      fileName: 'photo.png',
      isValidationPending: true,
      uploadProgress: 0.5,
    });

    expect(actionButton(el).progress).toBe(0);
  });

  it('name falls back to the l10n placeholder when no fileName/externalUrl', async () => {
    const ctxName = freshCtxName();
    const { el } = await mount(ctxName);
    await bindEntry(el, getCollection(ctxName), {});

    expect(fileNameText(el)).toBe('No name...');
  });

  it('shows the "waiting-for" source hint for a pending external-source entry', async () => {
    const ctxName = freshCtxName();
    const { el } = await mount(ctxName);
    await bindEntry(el, getCollection(ctxName), {
      externalUrl: 'https://example.com/x',
      source: 'dropbox',
    });

    expect(hintSpan(el).hasAttribute('hidden')).toBe(false);
    expect(hintSpan(el).textContent).toBe('Waiting for Dropbox');
  });

  it('reacts to a fileName change on the bound entry', async () => {
    const ctxName = freshCtxName();
    const { el } = await mount(ctxName);
    const collection = getCollection(ctxName);
    const uid = await bindEntry(el, collection, { fileName: 'old.png' });
    expect(fileNameText(el)).toBe('old.png');

    collection.publishProp(uid, 'fileName', 'new.png');
    await el.updateComplete;
    await delay(0);
    expect(fileNameText(el)).toBe('new.png');
  });

  it('clears focus when the bound entry transitions to uploading', async () => {
    const ctxName = freshCtxName();
    const { el } = await mount(ctxName);
    const collection = getCollection(ctxName);
    const uid = await bindEntry(el, collection, { fileName: 'photo.png' });

    el.click();
    expect(el.hasAttribute('focused')).toBe(true);

    collection.publishProp(uid, 'isUploading', true);
    await delay(120);
    expect(el.hasAttribute('focused')).toBe(false);
  });
});

// The uid-change path must fully rebind: the render getters + side-effects read
// `this.entry`/`this.uid`, and `reset()` tears down the previous entry's keyed
// subscription — so no state or subscription from a previous uid leaks in.
describe('FileItem uid rebinding', () => {
  it('rebinds to the new entry on uid change; the previous entry no longer drives it', async () => {
    const ctxName = freshCtxName();
    const { el } = await mount(ctxName);
    const collection = getCollection(ctxName);
    const uidA = await bindEntry(el, collection, { fileName: 'a.png' });
    expect(fileNameText(el)).toBe('a.png');

    const uidB = collection.add({ fileName: 'b.png' });
    el.uid = uidB;
    await el.updateComplete;
    await delay(0);
    expect(fileNameText(el)).toBe('b.png');

    // A write to the PREVIOUS entry must not leak into this item (subscription
    // torn down by reset(); its signals no longer tracked by render).
    collection.publishProp(uidA, 'fileName', 'a-changed.png');
    await el.updateComplete;
    await delay(120);
    expect(fileNameText(el)).toBe('b.png');

    // A write to the CURRENT entry still updates it.
    collection.publishProp(uidB, 'fileName', 'b-changed.png');
    await el.updateComplete;
    await delay(0);
    expect(fileNameText(el)).toBe('b-changed.png');
  });

  it('clears its bound entry when uid changes to an unknown id', async () => {
    const ctxName = freshCtxName();
    const { el } = await mount(ctxName);
    const collection = getCollection(ctxName);
    await bindEntry(el, collection, { fileName: 'a.png', fileInfo: { uuid: 'srv' } as never });
    expect(fileNameText(el)).toBe('a.png');
    expect(inner(el).hasAttribute('data-finished')).toBe(true);

    el.uid = 'nonexistent-uid' as Uid;
    await el.updateComplete;
    await delay(0);
    // entry === null → the name clears to '' (NOT the stale previous name, which
    // the pre-S2 @state mirror retained) and status flags reset.
    expect(fileNameText(el)).toBe('');
    expect(inner(el).hasAttribute('data-finished')).toBe(false);
  });

  it('does not let the previous entry drive side-effects after a uid change', async () => {
    const ctxName = freshCtxName();
    const { el } = await mount(ctxName);
    const collection = getCollection(ctxName);
    const uidA = await bindEntry(el, collection, { fileName: 'a.png' });

    const uidB = collection.add({ fileName: 'b.png' });
    el.uid = uidB;
    await el.updateComplete;
    await delay(0);

    el.click();
    expect(el.hasAttribute('focused')).toBe(true);

    // The PREVIOUS entry starting to upload must NOT clear this item's focus —
    // its keyed subscription (which drives focus-clear-on-uploading) is gone.
    collection.publishProp(uidA, 'isUploading', true);
    await delay(120);
    expect(el.hasAttribute('focused')).toBe(true);

    // The CURRENT entry uploading still clears focus.
    collection.publishProp(uidB, 'isUploading', true);
    await delay(120);
    expect(el.hasAttribute('focused')).toBe(false);
  });
});
