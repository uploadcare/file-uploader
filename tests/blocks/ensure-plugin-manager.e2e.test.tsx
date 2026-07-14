import { beforeAll, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import type { PluginController } from '@/abstract/managers/plugin';
import { getCtxName } from '../utils/test-renderer';
import '../../types/jsx';

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

// Coverage for the M10a seam: `ensureUploaderScope` now also constructs the
// ctx's `*pluginManager` (via `ensurePluginManager`) so a ChildBlock-only
// uploader composition — `<uc-config>` + `<uc-upload-ctx-provider>` with NO
// solution and NO `<uc-drop-area>`, i.e. no v1 `LitBlock` anywhere — still gets
// a plugin manager. Historically only `LitBlock.initCallback` built it; once
// the DropArea port (M10b) removes the last `LitBlock` from solution
// compositions, nothing else would, and lazy plugins / plugin sources would
// silently never load. This pins the ChildBlock-reachable construction path.
describe('ensureUploaderScope — *pluginManager without a v1 LitBlock (provider, no solution)', () => {
  it('constructs a live *pluginManager in a config + provider composition (no v1 LitBlock)', async () => {
    const { PubSub } = await import('@/lit/PubSubCompat.js');
    const ctxName = getCtxName();

    page.render(
      <>
        <uc-config qualityInsights={false} ctx-name={ctxName} pubkey="demopublickey" testMode></uc-config>
        <uc-upload-ctx-provider ctx-name={ctxName}></uc-upload-ctx-provider>
      </>,
    );

    await expect.poll(() => PubSub.hasCtx(ctxName)).toBe(true);
    // Sanity: genuinely no v1 `LitBlock`-bearing tag in this composition —
    // `<uc-upload-ctx-provider>` (a `ChildBlock`) is the only uploader block,
    // so nothing runs `LitBlock.initCallback` (the historical sole constructor
    // of `*pluginManager`).
    expect(
      document.querySelector(
        'uc-file-uploader-regular, uc-file-uploader-minimal, uc-file-uploader-inline, uc-drop-area',
      ),
    ).toBeNull();

    // The provider's `ensureUploaderScope` must have constructed the plugin
    // manager. Non-vacuous: `*pluginManager` is only present because
    // `ensurePluginManager` ran (nothing else constructs it here).
    const ctx = PubSub.getCtx(ctxName)!;
    await expect.poll(() => ctx.has('*pluginManager')).toBe(true);

    // ...and it is a live, wired `PluginController` (its `watchPlugins`/
    // `LazyPluginLoader` was hooked up in the ctor), not a stub: it exposes the
    // real API and its initial plugin-resolution settles. `pluginsReady()`
    // resolving proves the loader is subscribed and computed at least once.
    const pluginManager = ctx.read('*pluginManager') as PluginController;
    expect(pluginManager).toBeTruthy();
    expect(typeof pluginManager.onPluginsChange).toBe('function');
    await expect(pluginManager.pluginsReady()).resolves.toBeUndefined();
  });
});
