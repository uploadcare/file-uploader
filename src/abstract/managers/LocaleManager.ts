import { default as en } from '../../locales/file-uploader/en';
import type { ConfigType } from '../../types';
import { ConfigController } from '../controllers/ConfigController';
import { LocaleController } from '../controllers/LocaleController';
import { Disposables } from '../di/Disposables';
import { inject } from '../di/inject';
import { type LocaleDefinition, resolveLocaleDefinition } from '../localeRegistry';
import type { PluginController } from './plugin';

export const localeStateKey = <T extends keyof LocaleDefinition>(key: T): `*l10n/${T}` => `*l10n/${key}`;
export const DEFAULT_LOCALE = 'en';

/**
 * DOM-free locale orchestration: reads/writes the `ConfigController`/
 * `LocaleController` directly. Container-resolved with a zero-arg ctor,
 * `@inject`-ing both controllers instead of taking them in a deps object.
 *
 * Construction itself is side-effect-free — `ensureUploaderCtx` resolves this
 * eagerly (`container.get(LocaleManager)`) the moment a ctx's container is
 * created, including from contexts that never mount a block (e.g. a bare
 * per-upload-entry ctx, or a unit test exercising the config controller
 * alone). Seeding the `en` dictionary and wiring the config subscriptions as
 * part of the constructor would leak locale state into every such scope.
 * Instead {@link activate} — the real construction-time work — is called
 * explicitly by `ensureUploaderCtx` the moment a ctx's container exists (on
 * every path, including the pre-element one with no block mounted), and again
 * by `ensurePluginManager` to re-couple the real plugin manager. It also takes
 * the plugin-manager coupling (`onPluginsChange`/`snapshot`, for plugin-supplied
 * `registerL10n` dictionaries): `PluginController` isn't resolved by
 * `ensureUploaderCtx` (it's bound later by `ensurePluginManager`), so
 * `activate` accepts a nullable plugin manager and re-couples idempotently
 * when `ensurePluginManager` later activates it with the real one.
 */
export class LocaleManager {
  /** v2 config source of truth — `localeName`/`localeDefinitionOverride` reads + subscriptions. */
  @inject(ConfigController) private readonly _config!: ConfigController;
  /** v2 locale string store — where the resolved dictionary is written. */
  @inject(LocaleController) private readonly _locale!: LocaleController;
  private _localeName = '';
  private _activated = false;
  private _destroyed = false;
  readonly #disposables = new Disposables();
  private _pluginManager: Pick<PluginController, 'onPluginsChange' | 'snapshot'> | null = null;
  /** The live plugin-manager unsubscribe, run on re-wire; also registered in `#disposables`. */
  private _pluginManagerUnsub?: () => void;
  /** Unregisters {@link _pluginManagerUnsub} from `#disposables` (without running it) on re-wire. */
  private _cancelPluginManagerReg?: () => void;

  /**
   * Run the v1 construction-time work: seed the `en` defaults, wire the
   * plugin-manager coupling, and subscribe to `localeName`/
   * `localeDefinitionOverride`. Idempotent — the plugin-manager coupling is
   * always re-wired (harmless: unsub-then-resub) but the one-time seeding +
   * subscriptions only run once, so calling this again (e.g. a second block
   * sharing the ctx) is safe.
   */
  public activate(pluginManager: Pick<PluginController, 'onPluginsChange' | 'snapshot'> | null): void {
    // Re-wire the plugin-manager coupling: run the previous unsubscribe (detach
    // the old manager's `onPluginsChange`) and un-register it from `#disposables`
    // so `destroy()`'s `run()` won't double-invoke a stale unsub.
    try {
      this._pluginManagerUnsub?.();
    } catch (err) {
      // Isolate-and-warn: a throwing detach of the old manager's
      // `onPluginsChange` must not abort re-wiring (matching `destroy()`'s
      // `#disposables.run()` teardown convention), or the manager would be left
      // half re-wired with the new coupling never established.
      console.warn('[uc] LocaleManager: previous plugin-manager unsubscribe threw', err);
    }
    this._cancelPluginManagerReg?.();
    this._pluginManagerUnsub = undefined;
    this._cancelPluginManagerReg = undefined;
    this._pluginManager = pluginManager;
    if (pluginManager?.onPluginsChange) {
      this._pluginManagerUnsub = pluginManager.onPluginsChange(() => {
        if (this._localeName) {
          this._applyPluginLocales(this._localeName);
        }
      });
      this._cancelPluginManagerReg = this.#disposables.add(this._pluginManagerUnsub);
    }

    if (this._activated) {
      return;
    }
    this._activated = true;

    for (const [key, value] of Object.entries(en) as [keyof LocaleDefinition, string][]) {
      const noTranslation = this._locale.has(key) ? !this._locale.get(key) : true;
      this._setLocale(key, value, noTranslation);
    }

    this.#disposables.add(
      this._subConfig('localeName', async (localeName) => {
        if (!localeName) {
          return;
        }
        this._localeName = localeName;
        const definition = await resolveLocaleDefinition(localeName);
        // Uniform staleness guard: `resolveLocaleDefinition` always crosses a
        // microtask boundary — even for the `en` default — so a rapid
        // second `localeName` change in the same tick can settle this
        // continuation after `_localeName` has already moved on. Applying it
        // then would clobber the newer locale's dictionary with the stale
        // one's. Bail uniformly (no `en`-only carve-out) and also bail if
        // the manager was torn down while this resolution was in flight.
        if (this._destroyed || this._localeName !== localeName) {
          return;
        }
        this._applyPluginLocales(localeName);

        this._applyOverrides(localeName, definition);
      }),
    );

    this.#disposables.add(
      this._subConfig('localeDefinitionOverride', (localeDefinitionOverride) => {
        if (!localeDefinitionOverride) {
          return;
        }
        const definition = localeDefinitionOverride[this._localeName];
        if (!definition) {
          return;
        }
        this._applyOverrides(this._localeName, definition);
      }),
    );
  }

  /**
   * Subscribe to a config key's derived value: fires once immediately with
   * the current value, then again only when it actually changes — the same
   * per-key dedup semantics as the v1 ctx facade's `*cfg/` facade (which this
   * replaces for `LocaleManager`'s two config reads).
   */
  private _subConfig<K extends keyof ConfigType>(key: K, cb: (value: ConfigType[K]) => void): () => void {
    let last = this._config.get(key);
    cb(last);
    return this._config.subscribe(() => {
      const next = this._config.get(key);
      if (!Object.is(next, last)) {
        last = next;
        cb(next);
      }
    });
  }

  private _setLocale(key: string, value: string, rewrite: boolean): void {
    if (!this._locale.has(key) || rewrite) {
      this._locale.set(key, value);
    }
  }

  private _applyOverrides(localeName: string, definition: Partial<LocaleDefinition>): void {
    const overrides = this._config.get('localeDefinitionOverride')?.[localeName];
    for (const [key, value] of Object.entries(definition) as [keyof LocaleDefinition, string][]) {
      const overriddenValue = overrides?.[key];
      this._setLocale(key, overriddenValue ?? value, true);
    }
  }

  private _applyPluginLocales(localeName: string): void {
    const manager = this._pluginManager;
    if (!manager) {
      return;
    }

    const snapshot = manager.snapshot();
    for (const entry of snapshot.l10n) {
      const { pluginId: _pluginId, ...locales } = entry as unknown as Record<string, Partial<LocaleDefinition>> & {
        pluginId?: string;
      };

      const pluginDefinition = locales[localeName];
      if (!pluginDefinition) {
        continue;
      }

      for (const [key, value] of Object.entries(pluginDefinition) as [keyof LocaleDefinition, string | undefined][]) {
        if (value === undefined) {
          continue;
        }
        this._setLocale(key, value, true);
      }
    }
  }

  public destroy(): void {
    this._destroyed = true;
    // `#disposables` holds the plugin-manager unsub (if wired) alongside the two
    // config subscriptions, so `run()` tears down all three (isolate-and-warn).
    this._pluginManagerUnsub = undefined;
    this._cancelPluginManagerReg = undefined;
    this.#disposables.run();
  }
}
