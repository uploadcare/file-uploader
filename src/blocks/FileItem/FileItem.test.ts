import { afterEach, describe, expect, it, vi } from 'vitest';
import { CollectionStateController } from '../../abstract/controllers/CollectionStateController';
import { ConfigController } from '../../abstract/controllers/ConfigController';
import { UploadCollectionController } from '../../abstract/controllers/UploadCollectionController';
import { UploadController } from '../../abstract/controllers/UploadController';
import { PluginController } from '../../abstract/managers/plugin';
import { TelemetryManager } from '../../abstract/managers/TelemetryManager';
import { UploaderPublicApi } from '../../abstract/UploaderPublicApi';
import { UploaderRegistry } from '../../abstract/UploaderRegistry';
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

describe('FileItem (M-god step 6b-6 migration)', () => {
  it('declares its dependencies via static uses', () => {
    expect(FileItem.uses).toEqual([ConfigController, UploadCollectionController, UploaderPublicApi, TelemetryManager]);
  });

  it('pre-warms its declared dependencies into the container on adoption', async () => {
    const ctxName = freshCtxName();
    await mount(ctxName);
    const container = UploaderRegistry.get(ctxName);
    // `static uses` pre-warm resolves both deps eagerly on adoption, so they
    // exist (as the container's own singletons) before first render.
    expect(container?.get(ConfigController)).toBeInstanceOf(ConfigController);
    expect(container?.get(TelemetryManager)).toBeInstanceOf(TelemetryManager);
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

  it('the uploadTrigger subscription fires only when the trigger Set is replaced, not on unrelated collection-state writes (per-key Object.is dedup)', async () => {
    const ctxName = freshCtxName();
    const { el } = await mount(ctxName);
    // Flush the init uploadTrigger tick (scheduled in controllerReady) against the
    // real, entry-less `_upload` (a no-op) before swapping in the spy.
    await delay(0);

    const collectionState = UploaderRegistry.get(ctxName)?.get(CollectionStateController);
    if (!collectionState) throw new Error('collection-state controller not resolved');

    const upload = vi.fn();
    (el as unknown as { _upload: () => void })._upload = upload;

    // Unrelated collection-state write -> the uploadTrigger handler is deduped
    // (`Object.is` over the coarse notify), so no upload is scheduled.
    collectionState.set('commonProgress', 50);
    await delay(0);
    expect(upload).not.toHaveBeenCalled();

    // Mutating the SAME Set in place is `Object.is`-equal -> no notify, no fire
    // (the writer REPLACES the Set; mutate-in-place is a no-op, matching v1).
    const current = collectionState.get('uploadTrigger');
    current.add('file-x' as Uid);
    collectionState.set('uploadTrigger', current);
    await delay(0);
    expect(upload).not.toHaveBeenCalled();

    // Replacing the Set fires the handler; with no entry on this bare item the
    // handler schedules the upload attempt unconditionally.
    collectionState.set('uploadTrigger', new Set<Uid>(['file-y' as Uid]));
    await delay(0);
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it('_upload delegates to use(UploadController).uploadEntry with the entry uid', async () => {
    const ctxName = freshCtxName();
    const { el } = await mount(ctxName);
    const container = UploaderRegistry.get(ctxName);
    if (!container) throw new Error('container not resolved');

    const uploadEntry = vi.fn();
    container.bind(UploadController, () => ({ uploadEntry }) as unknown as UploadController);
    // Poke a minimal entry — `_upload` reads only `.uid` off it.
    (el as unknown as { entry: { uid: Uid } }).entry = { uid: 'file-1' as Uid };

    await (el as unknown as { _upload: () => Promise<void> })._upload();
    expect(uploadEntry).toHaveBeenCalledWith('file-1');
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
