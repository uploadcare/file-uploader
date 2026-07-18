import type { PluginController } from '../managers/plugin';

/**
 * Editor-safe DI token for reaching the ctx's container-owned
 * {@link PluginController} WITHOUT a value import of it.
 *
 * `<uc-config>` (the config writer) needs the plugin manager to register plugin
 * custom-config definitions, but it ships in the standalone editor bundle where
 * a value import of `PluginController` would drag `PluginRegistry` / the plugin
 * stack in and blow the editor's 50 KB size-limit. So `<uc-config>` value-imports
 * ONLY this token and reads the manager through `getPluginManager()`.
 *
 * Same `declare`-only pattern as {@link UploadHostBridge}: the single member is
 * type-level (no runtime body), so the class compiles to ~0 bytes — it exists
 * purely as the container token + the structural type the bound factory's object
 * literal satisfies. It is never `new`-ed; the container resolves it through the
 * factory `ensurePluginManager` binds (`() => container.get(PluginController)`).
 * A concrete (non-abstract) class so it stays assignable as a `Token<T>`.
 *
 * Bound ONLY in uploader scopes (`ensurePluginManager`). In an editor-alone
 * composition (no uploader scope) the token is never bound, so
 * `container.getOrNull(PluginManagerBridge)` is `null` and
 * `container.whenController(PluginManagerBridge, cb)` never fires — plugin
 * custom-config registration correctly no-ops (there are no plugins standalone).
 */
export class PluginManagerBridge {
  /** Resolves the ctx's container-owned plugin manager. */
  public declare readonly getPluginManager: () => PluginController;
}
