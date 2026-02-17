import { SharedInstance, type SharedInstancesBag } from '../../lit/shared-instances';
import { default as en } from '../../locales/file-uploader/en';
import { type LocaleDefinition, resolveLocaleDefinition } from '../localeRegistry';
import { sharedConfigKey } from '../sharedConfigKey';

export const localeStateKey = <T extends keyof LocaleDefinition>(key: T): `*l10n/${T}` => `*l10n/${key}`;
export const DEFAULT_LOCALE = 'en';

export class LocaleManager extends SharedInstance {
  private _localeName = '';

  public constructor(sharedInstancesBag: SharedInstancesBag) {
    super(sharedInstancesBag);

    for (const [key, value] of Object.entries(en) as [keyof LocaleDefinition, string][]) {
      const noTranslation = this._ctx.has(localeStateKey(key)) ? !this._ctx.read(localeStateKey(key)) : true;
      this._ctx.add(localeStateKey(key), value, noTranslation);
    }

    const pluginManager = sharedInstancesBag.pluginManager;
    if (pluginManager?.onPluginsChange) {
      this.addSub(
        pluginManager.onPluginsChange(() => {
          if (this._localeName) {
            this._applyPluginLocales(this._localeName);
          }
        }),
      );
    }

    this.addSub(
      this._ctx.sub(sharedConfigKey('localeName'), async (localeName) => {
        if (!localeName) {
          return;
        }
        this._localeName = localeName;
        const definition = await resolveLocaleDefinition(localeName);
        if (localeName !== DEFAULT_LOCALE && this._localeName !== localeName) {
          return;
        }
        this._applyPluginLocales(localeName);

        this._applyOverrides(localeName, definition);

      }),
    );

    this.addSub(
      this._ctx.sub(sharedConfigKey('localeDefinitionOverride'), (localeDefinitionOverride) => {
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

  private _applyOverrides(localeName: string, definition: Partial<LocaleDefinition>): void {
    const overrides = this._cfg.localeDefinitionOverride?.[localeName];
    for (const [key, value] of Object.entries(definition) as [keyof LocaleDefinition, string][]) {
      const overriddenValue = overrides?.[key];
      this._ctx.add(localeStateKey(key), overriddenValue ?? value, true);
    }
  }

  private _applyPluginLocales(localeName: string): void {
    const pluginManager = this._sharedInstancesBag.pluginManager;
    if (!pluginManager) {
      return;
    }

    const snapshot = pluginManager.snapshot();
    for (const entry of snapshot.i18n) {
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
        this._ctx.add(localeStateKey(key), value, true);
      }
    }
  }
}
