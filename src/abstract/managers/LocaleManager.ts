import { default as en } from '../../locales/file-uploader/en';
import { controllerLogger } from '../controllerLogger';
import { ConfigController } from '../controllers/ConfigController';
import { LocaleController } from '../controllers/LocaleController';
import { lifetimeOf } from '../di/ControllerContainer';
import { Disposables } from '../di/Disposables';
import { inject } from '../di/inject';
import { type LocaleDefinition, resolveLocaleDefinition } from '../localeRegistry';
import type { PluginController } from './plugin';

/**
 * Keeps the ctx's locale dictionary in step with `localeName`, `localeDefinitionOverride` and the dictionaries
 * plugins register, falling back to `en` for missing keys.
 *
 * Constructing it does nothing, so a ctx that never shows a locale carries no locale state; {@link activate} starts
 * it. `activate` may be called again, and a later call with the real plugin manager picks up plugin dictionaries.
 */
export class LocaleManager {
  // Per-ctx logger: `warn`/`error` always print, prefixed with THIS ctx's name
  // (resolved lazily at log time via the container that built this instance).
  private readonly _log = controllerLogger(this, 'locale-manager');
  /** v2 config source of truth — `localeName`/`localeDefinitionOverride` reads + subscriptions. */
  @inject(ConfigController) private readonly _config!: ConfigController;
  /** v2 locale string store — where the resolved dictionary is written. */
  @inject(LocaleController) private readonly _locale!: LocaleController;
  private _localeName = '';
  /** The active locale's resolved dictionary — what a key falls back to once no plugin supplies it. */
  private _definition: Partial<LocaleDefinition> = en;
  /** Keys the registered plugins currently supply, so a key a plugin stops supplying can be restored. */
  private _pluginKeys = new Set<keyof LocaleDefinition>();
  private _activated = false;
  readonly #disposables = new Disposables();
  private _pluginManager: Pick<PluginController, 'onPluginsChange' | 'snapshot'> | null = null;
  /** The live plugin-manager unsubscribe, run on re-wire; also registered in `#disposables`. */
  private _pluginManagerUnsub?: () => void;
  /** Unregisters {@link _pluginManagerUnsub} from `#disposables` (without running it) on re-wire. */
  private _cancelPluginManagerReg?: () => void;

  /**
   * Start: seed the `en` defaults, wire the
   * plugin-manager coupling, and subscribe to `localeName`/
   * `localeDefinitionOverride`. Idempotent — the one-time seeding +
   * subscriptions only run once, so calling this again (e.g. a second block
   * sharing the ctx) is safe. A plugin manager passed in is (re-)coupled; called
   * without one, the current coupling stays; `null` detaches it.
   */
  public activate(pluginManager?: Pick<PluginController, 'onPluginsChange' | 'snapshot'> | null): void {
    if (pluginManager !== undefined) {
      this._couplePluginManager(pluginManager);
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
      this._config.observe(
        'localeName',
        (localeName) => {
          if (!localeName) {
            return;
          }
          this._localeName = localeName;
          // Bound to the ctx: a resolution still in flight when it is torn down applies nothing.
          const lifetime = lifetimeOf(this);
          lifetime.run(
            async () => {
              const definition = await lifetime.guard(resolveLocaleDefinition(localeName));
              // Uniform staleness guard: `resolveLocaleDefinition` always crosses a
              // microtask boundary — even for the `en` default — so a rapid
              // second `localeName` change in the same tick can settle this
              // continuation after `_localeName` has already moved on. Applying it
              // then would clobber the newer locale's dictionary with the stale
              // one's. Bail uniformly (no `en`-only carve-out).
              if (this._localeName !== localeName) {
                return;
              }
              this._definition = definition;
              // Layered built-in < plugin < `localeDefinitionOverride`: the dictionary goes first so a plugin's
              // translation of a built-in key survives a locale switch.
              this._applyOverrides(localeName, definition);
              this._applyPluginLocales(localeName);
            },
            (error) => this._log.error(`Failed to resolve locale "${localeName}"`, error),
          );
        },
        { immediate: true },
      ),
    );

    this.#disposables.add(
      this._config.observe(
        'localeDefinitionOverride',
        (localeDefinitionOverride) => {
          if (!localeDefinitionOverride) {
            return;
          }
          const definition = localeDefinitionOverride[this._localeName];
          if (!definition) {
            return;
          }
          this._applyOverrides(this._localeName, definition);
        },
        { immediate: true },
      ),
    );
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

    const supplied = new Map<keyof LocaleDefinition, string>();
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
        if (value !== undefined) {
          supplied.set(key, value);
        }
      }
    }

    // Restore what an unregistered plugin had replaced. A key only a plugin ever defined keeps its last value:
    // the locale store has no delete, and nothing renders that key once its plugin is gone.
    const overrides = this._config.get('localeDefinitionOverride')?.[localeName];
    for (const key of this._pluginKeys) {
      const base = supplied.has(key) ? undefined : (overrides?.[key] ?? this._definition[key]);
      if (base !== undefined) {
        this._setLocale(key, base, true);
      }
    }
    this._pluginKeys = new Set(supplied.keys());

    for (const [key, value] of supplied) {
      this._setLocale(key, overrides?.[key] ?? value, true);
    }
  }

  private _couplePluginManager(pluginManager: Pick<PluginController, 'onPluginsChange' | 'snapshot'> | null): void {
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
      this._log.warn('LocaleManager: previous plugin-manager unsubscribe threw', err);
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
  }

  public destroy(): void {
    // `#disposables` holds the plugin-manager unsub (if wired) alongside the two
    // config subscriptions, so `run()` tears down all three (isolate-and-warn).
    this._pluginManagerUnsub = undefined;
    this._cancelPluginManagerReg = undefined;
    this.#disposables.run();
  }
}
