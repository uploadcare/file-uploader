import { PluginController } from '../abstract/managers/plugin';
import { buildPluginApi } from '../abstract/managers/plugin/buildPluginApi';
import { LazyPluginLoader } from '../abstract/managers/plugin/LazyPluginLoader';
import { createDebugPrinter } from './createDebugPrinter';
import type { SharedInstancesBag } from './shared-instances';

/**
 * ChildBlock-reachable construction of the ctx's `*pluginManager`, lifted from
 * `LitBlock.initCallback` (`src/lit/LitBlock.ts`), which constructs it for any
 * v1 block. Everything `PluginController` needs is `bag`-derived (`bag.ctx`,
 * `bag`, and the lazy `bag.api`) — no element/DOM dependency — so it can be
 * built from a pure-`ChildBlock` composition (e.g. `<uc-config>` +
 * `<uc-upload-ctx-provider>` with no solution/`<uc-drop-area>`, i.e. no
 * `LitBlock` at all).
 *
 * First-write-wins: if a v1 `LitBlock` sharing this ctx already registered a
 * `*pluginManager`, this is a no-op — inert-under-v1, and the two recipes
 * produce a functionally identical `PluginController` either way (same as the
 * M9q re-exposer dual-registration).
 *
 * Call from an uploader-present seam (`ensureUploaderScope`), AFTER the scope
 * is attached so `*publicApi` exists for the lazy `getUploaderApi`. It also
 * (re-)activates the ctx locale's plugin coupling with the now-present manager
 * — idempotent via `LocaleManager`'s `_activated` guard — matching how
 * `LitBlock.initCallback` calls `localeManager.activate(pluginManager)` right
 * after constructing it.
 */
export function ensurePluginManager(bag: SharedInstancesBag): void {
  const ctx = bag.ctx;
  if (ctx.has('*pluginManager')) {
    return;
  }
  const pluginManager = new PluginController({
    buildApi: (registry, pluginId, configSubscriptions) =>
      buildPluginApi(registry, ctx, bag, pluginId, configSubscriptions),
    getUploaderApi: () => bag.api,
    watchPlugins: (onCompute) => {
      const loader = new LazyPluginLoader(ctx, onCompute);
      return () => loader.destroy();
    },
    // Scope debug output to the controller (not a hosting block) so its logs
    // stay consistently prefixed, as v1's `SharedInstance` did.
    debug: createDebugPrinter(() => ctx, 'PluginController'),
  });
  ctx.add('*pluginManager', pluginManager, true);
  ctx.uploaderController().localeManager.activate(pluginManager);
}
