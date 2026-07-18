import { PluginController } from '../abstract/managers/plugin';
import { buildPluginApi } from '../abstract/managers/plugin/buildPluginApi';
import { LazyPluginLoader } from '../abstract/managers/plugin/LazyPluginLoader';
import { createDebugPrinter } from './createDebugPrinter';
import { addCtxSharedInstance, type SharedInstancesBag } from './shared-instances';

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
  // Resolve the ctx's `ConfigController` once — the plugin API and lazy loader
  // read config directly off it (M-god step 7), not through the `*cfg/*` facade.
  const config = ctx.uploaderController().config;
  // Register through `addCtxSharedInstance` (NOT a raw `ctx.add`) so the manager
  // is recorded in the `*sharedContextInstances` bookkeeping map — exactly what
  // v1's `LitBlock._addSharedContextInstance` did. `destroyCtx` walks that map
  // and calls `.destroy()` on non-controller-owned instances, so this is what
  // makes the plugin manager (its `LazyPluginLoader` subscriptions, registry)
  // actually tear down on ctx destroy. A raw `ctx.add` would leak it.
  addCtxSharedInstance(
    ctx,
    '*pluginManager',
    () =>
      new PluginController({
        buildApi: (registry, pluginId, configSubscriptions) =>
          buildPluginApi(registry, config, bag, pluginId, configSubscriptions),
        getUploaderApi: () => bag.api,
        watchPlugins: (onCompute) => {
          const loader = new LazyPluginLoader(ctx, config, onCompute);
          return () => loader.destroy();
        },
        // Scope debug output to the controller (not a hosting block) so its
        // logs stay consistently prefixed, as v1's `SharedInstance` did.
        debug: createDebugPrinter(() => ctx, 'PluginController'),
      }),
  );
  const pluginManager = ctx.has('*pluginManager') ? ctx.read('*pluginManager') : null;
  if (pluginManager) {
    ctx.uploaderController().localeManager.activate(pluginManager);
  }
}
