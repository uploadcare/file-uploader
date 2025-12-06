import type { LitBlock } from '../../lit/LitBlock';
import { default as en } from '../../locales/file-uploader/en';
import { resolveLocaleDefinition } from '../localeRegistry';

export const localeStateKey = (key: string): string => `*l10n/${key}`;
export const DEFAULT_LOCALE = 'en';

export class LocaleManager {
  private _blockInstance: LitBlock | null = null;
  private _localeName = '';

  public constructor(blockInstance: LitBlock) {
    this._blockInstance = blockInstance;

    for (const [key, value] of Object.entries(en)) {
      const noTranslation = this._blockInstance.has(localeStateKey(key))
        ? !this._blockInstance.$[localeStateKey(key)]
        : true;
      this._blockInstance.add(localeStateKey(key), value, noTranslation);
    }

    setTimeout(() => {
      blockInstance.subConfigValue('localeName', async (localeName) => {
        if (!this._blockInstance || !localeName) {
          return;
        }
        this._localeName = localeName;
        const definition = await resolveLocaleDefinition(localeName);
        if (localeName !== DEFAULT_LOCALE && this._localeName !== localeName) {
          return;
        }

        const overrides = this._blockInstance.cfg.localeDefinitionOverride?.[localeName];
        for (const [key, value] of Object.entries(definition)) {
          const overriddenValue = overrides?.[key];
          this._blockInstance.add(localeStateKey(key), overriddenValue ?? value, true);
        }
      });

      blockInstance.subConfigValue('localeDefinitionOverride', (localeDefinitionOverride) => {
        if (!localeDefinitionOverride) {
          return;
        }
        const definition = localeDefinitionOverride[this._localeName];
        if (!definition) {
          return;
        }
        for (const [key, value] of Object.entries(definition)) {
          this._blockInstance?.add(localeStateKey(key), value, true);
        }
      });
    });
  }
}
