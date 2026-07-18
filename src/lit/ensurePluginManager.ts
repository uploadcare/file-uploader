import { PluginController } from '../abstract/managers/plugin';
import { buildPluginApi } from '../abstract/managers/plugin/buildPluginApi';
import { LazyPluginLoader } from '../abstract/managers/plugin/LazyPluginLoader';
import { UploaderPublicApi } from '../abstract/UploaderPublicApi';
import { createDebugPrinter } from './createDebugPrinter';
import { addCtxSharedInstance, type SharedInstancesBag } from './shared-instances';

/**
 * ChildBlock-reachable construction of the ctx's `*pluginManager`, lifted from
 * `LitBlock.initCallback` (`src/lit/LitBlock.ts`), which constructs it for any
 * v1 block. Everything `PluginController` needs is `bag`-derived (`bag.ctx`,
 * `bag`, and the lazy public API) — no element/DOM dependency — so it can be
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
 * is attached so the public API is registered for the lazy `getUploaderApi`. It
 * also (re-)activates the ctx locale's plugin coupling with the now-present
 * manager — idempotent via `LocaleManager`'s `_activated` guard — matching how
 * `LitBlock.initCallback` calls `localeManager.activate(pluginManager)` right
 * after constructing it.
 *
 * M-god step 8c: `PluginController` is now **container-owned**. It has
 * host/closure deps (`buildApi` wraps `buildPluginApi` + `bag`, `watchPlugins`
 * wraps the ctx-watching `LazyPluginLoader`, `getUploaderApi` resolves the
 * public API, `debug`), so it can't be a zero-arg container token — it is
 * `bind`-ed here with a host-value factory (the same element-layer seam that
 * used to `new` it inline). The `*pluginManager` shared instance stays as a
 * re-exposer of the SAME container instance, so `bag.pluginManager` /
 * `ctx.read('*pluginManager')` / `bag.when('pluginManager')` keep resolving it
 * unchanged during the transition — while `UploaderPublicApi` now reaches it
 * via `@inject(() => PluginController)`.
 */
export function ensurePluginManager(bag: SharedInstancesBag): void {
  const ctx = bag.ctx;
  if (ctx.has('*pluginManager')) {
    return;
  }
  const controller = ctx.uploaderController();
  const container = controller.container;
  // Resolve the ctx's `ConfigController` once — the plugin API and lazy loader
  // read config directly off it (M-god step 7), not through the `*cfg/*` facade.
  const config = controller.config;

  // Bind `PluginController` as a host-value factory on the per-ctx container.
  // `getUploaderApi` is a LAZY thunk (`c.get(UploaderPublicApi)`, resolved at
  // plugin-`setup()` time), so there is no construction cycle with the api. The
  // first-write-wins guard above means this `bind` runs at most once per ctx.
  container.bind(
    PluginController,
    (c) =>
      new PluginController({
        buildApi: (registry, pluginId, configSubscriptions) =>
          buildPluginApi(registry, config, bag, pluginId, configSubscriptions),
        getUploaderApi: () => c.get(UploaderPublicApi),
        watchPlugins: (onCompute) => {
          const loader = new LazyPluginLoader(ctx, config, onCompute);
          return () => loader.destroy();
        },
        // Scope debug output to the controller (not a hosting block) so its
        // logs stay consistently prefixed, as v1's `SharedInstance` did.
        debug: createDebugPrinter(() => ctx, 'PluginController'),
      }),
  );

  // Eagerly construct so lazy plugins / plugin sources start loading immediately
  // (v1 parity: `LitBlock.initCallback` constructed the manager eagerly) and so
  // the container records it for reverse-order disposal.
  const pluginManager = container.get(PluginController);

  // Preserve the `*pluginManager` shared-instance surface as a re-exposer of the
  // SAME container instance. Registering via `addCtxSharedInstance` (NOT a raw
  // `ctx.add`) keeps it in the `*sharedContextInstances` bookkeeping map so
  // `destroyCtx` pub-nulls the key on teardown — but `*pluginManager` is now a
  // `controllerOwnedInstanceKey`, so `destroyCtx` SKIPS its `.destroy()`; the
  // container disposes it exactly once (same ownership model as the clipboard /
  // upload stack, M-god step 8b/5). A raw `ctx.add` would leave it out of that
  // teardown bookkeeping.
  addCtxSharedInstance(ctx, '*pluginManager', () => pluginManager);

  controller.localeManager.activate(pluginManager);
}
