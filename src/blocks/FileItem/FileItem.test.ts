import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfigController } from '../../abstract/controllers/ConfigController';
import { PluginController } from '../../abstract/managers/plugin';
import { TelemetryManager } from '../../abstract/managers/TelemetryManager';
import { UploaderRegistry } from '../../abstract/UploaderRegistry';
import { ensureUploaderCtx } from '../../lit/ensureUploaderCtx';
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
