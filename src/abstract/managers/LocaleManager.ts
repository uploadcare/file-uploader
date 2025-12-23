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

        const overrides = this._cfg.localeDefinitionOverride?.[localeName];
        for (const [key, value] of Object.entries(definition) as [keyof LocaleDefinition, string][]) {
          const overriddenValue = overrides?.[key];
          this._ctx.add(localeStateKey(key), overriddenValue ?? value, true);
        }
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
        for (const [key, value] of Object.entries(definition) as [keyof LocaleDefinition, string][]) {
          this._ctx.add(localeStateKey(key), value, true);
        }
      }),
    );
  }
}
