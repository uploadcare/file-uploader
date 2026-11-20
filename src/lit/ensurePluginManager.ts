import { ConfigController } from '../abstract/controllers/ConfigController';
import { LazyPluginsController } from '../abstract/controllers/LazyPluginsController';
import type { ControllerContainer } from '../abstract/di/ControllerContainer';
import { LocaleManager } from '../abstract/managers/LocaleManager';
import { PluginController } from '../abstract/managers/plugin';
import { buildPluginApi } from '../abstract/managers/plugin/buildPluginApi';
import { LazyPluginLoader } from '../abstract/managers/plugin/LazyPluginLoader';
import { UploaderPublicApi } from '../abstract/UploaderPublicApi';

/**
 * ChildBlock-reachable construction of the ctx's `PluginController`. Everything `PluginController` needs is container-derived (config, the lazy
 * public API, the lazy-plugin owner) — no element/DOM dependency — so it can be
 * built from a pure-`ChildBlock` composition (e.g. `<uc-config>` +
 * `<uc-upload-ctx-provider>` with no solution/`<uc-drop-area>`).
 *
 * First-write-wins: if a sibling host sharing this ctx already resolved
 * `PluginController`, this is a no-op.
 *
 * Call from an uploader-present seam (`ensureUploaderScope`), AFTER the scope is
 * attached so the public API is registered for the lazy `getUploaderApi`. It
 * also (re-)activates the ctx locale's plugin coupling with the now-present
 * manager — idempotent via `LocaleManager`'s `_activated` guard.
 *
 * `PluginController` is container-owned. It has host/closure deps
 * (`buildApi` wraps `buildPluginApi` + the container, `watchPlugins` wraps the
 * `LazyPluginLoader` over the ctx's `LazyPluginsController`, `getUploaderApi`
 * resolves the public API), so it can't be a zero-arg container token —
 * it is `bind`-ed here with a host-value factory, then the container owns its
 * disposal (`container.dispose()` in reverse order). `UploaderPublicApi` reaches
 * it via `@inject(() => PluginController)`.
 */
export function ensurePluginManager(container: ControllerContainer): void {
  if (container.has(PluginController)) {
    return;
  }
  // Resolve the ctx's `ConfigController` once — the plugin API and lazy loader
  // read config directly off it.
  const config = container.get(ConfigController);

  // Bind `PluginController` as a host-value factory on the per-ctx container.
  // `getUploaderApi` is a LAZY thunk (`c.get(UploaderPublicApi)`, resolved at
  // plugin-`setup()` time), so there is no construction cycle with the api. The
  // first-write-wins guard above means this `bind` runs at most once per ctx.
  container.bind(
    PluginController,
    (c) =>
      new PluginController({
        buildApi: (registry, pluginId, configSubscriptions, log) =>
          buildPluginApi(registry, config, container, pluginId, configSubscriptions, log),
        getUploaderApi: () => c.get(UploaderPublicApi),
        watchPlugins: (onCompute) => {
          const loader = new LazyPluginLoader(c.get(LazyPluginsController), config, onCompute);
          return () => loader.destroy();
        },
      }),
  );

  // Eagerly construct so lazy plugins / plugin sources start loading immediately
  // and so the container records it for reverse-order disposal.
  const pluginManager = container.get(PluginController);

  container.get(LocaleManager).activate(pluginManager);
}
