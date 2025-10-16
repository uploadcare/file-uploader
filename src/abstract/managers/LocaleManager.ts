import { default as en } from '../../locales/file-uploader/en';
import { debounce } from '../../utils/debounce';
import type { Block } from '../Block';
import { resolveLocaleDefinition } from '../localeRegistry';

type LocaleChangeCallback = () => void;

export const localeStateKey = (key: string): string => `*l10n/${key}`;
export const DEFAULT_LOCALE = 'en';

export class LocaleManager {
  private _blockInstance: Block | null = null;
  private _localeName = '';
  private _callbacks: Set<LocaleChangeCallback> = new Set();
  private _boundBlocks: Map<Block, Map<string, () => void>> = new Map();

  constructor(blockInstance: Block) {
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
          for (const callback of this._callbacks) {
            callback();
          }
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
          for (const callback of this._callbacks) {
            callback();
          }
        }
      });
    });
  }

  onLocaleChange(callback: LocaleChangeCallback): () => void {
    const debouncedCb = debounce(callback, 0);
    this._callbacks.add(debouncedCb);
    return () => {
      this._callbacks.delete(debouncedCb);
    };
  }

  bindL10n(block: Block, key: string, resolver: LocaleChangeCallback): void {
    block.$[key] = resolver();

    if (!this._boundBlocks.has(block)) {
      this._boundBlocks.set(block, new Map());
    }

    this._boundBlocks.get(block)?.get(key)?.();

    const destroyCallback = this.onLocaleChange(() => {
      block.$[key] = resolver();
    });

    this._boundBlocks.get(block)?.set(key, destroyCallback);
  }

  destroyL10nBindings(block: Block): void {
    const callbacks = this._boundBlocks.get(block);
    if (!callbacks) {
      return;
    }
    for (const callback of callbacks.values()) {
      callback();
    }
    this._boundBlocks.delete(block);
  }

  destroy(): void {
    this._callbacks.clear();
  }
}
