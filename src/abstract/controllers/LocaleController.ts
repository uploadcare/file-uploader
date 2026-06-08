import enLocale from '../../locales/file-uploader/en';
import { getPluralForm } from '../../utils/getPluralForm';
import { applyTemplateData, getPluralObjects } from '../../utils/template-utils';
import { Listeners } from '../host-subscription';
import type { ConfigController } from './ConfigController';

// v2 uses v1's English dictionary verbatim. Plugins extend it via
// `controller.locale.merge(entries)` if they need new keys.
const DEFAULT_LOCALE: Record<string, string> = enLocale as unknown as Record<string, string>;

/**
 * v2-native locale store. Dictionary-backed; ICU plural syntax is
 * resolved inline via the same pure utilities v1 used (`getPluralForm`
 * + `getPluralObjects` + `applyTemplateData`) — no PubSub, no async.
 *
 * Resolution order for a given key:
 *   1. `config.localeDefinitionOverride` (user-supplied; highest)
 *   2. `merge()` entries (plugin-supplied)
 *   3. built-in default dictionary
 *   4. the key itself (last-resort fallback)
 */
export class LocaleController {
  private _listeners = new Listeners();
  private _overrides: Record<string, string> = {};
  private _registered: Record<string, string> = {};
  private _configUnsub?: () => void;

  public constructor(private _config: ConfigController) {
    this._applyOverrideFromConfig();
    this._configUnsub = this._config.subscribe(() => this._applyOverrideFromConfig());
  }

  public subscribe(listener: () => void): () => void {
    return this._listeners.subscribe(listener);
  }

  /**
   * Translate `key` with optional variable interpolation. Supports v1's
   * ICU plural syntax (`{{plural:file(count)}}`) — the plural form is
   * resolved against the configured locale id (defaults to `'en'`).
   */
  public t(key: string, vars?: Record<string, unknown>): string {
    const template = this._lookup(key);
    const variables: Record<string, string | number> = {};
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        variables[k] = typeof v === 'number' ? v : String(v ?? '');
      }
    }
    // Resolve plural placeholders to the matching `pluralKey__form` entry
    // (e.g. `file__one` / `file__other`) before applying substitutions.
    const pluralObjects = getPluralObjects(template);
    if (pluralObjects.length > 0) {
      const localeId = this._lookup('locale-id') || 'en';
      for (const po of pluralObjects) {
        const count = Number(variables[po.countVariable] ?? 0);
        const form = getPluralForm(localeId, count);
        variables[po.variable] = this._lookup(`${po.pluralKey}__${form}`);
      }
    }
    return applyTemplateData(template, variables);
  }

  /**
   * Merge plugin-supplied locale entries into the dictionary. Lowest
   * priority: user-supplied `localeDefinitionOverride` wins over these.
   */
  public merge(entries: Record<string, string>): () => void {
    const added: string[] = [];
    for (const [key, value] of Object.entries(entries)) {
      if (this._registered[key] !== value) {
        this._registered[key] = value;
        added.push(key);
      }
    }
    if (added.length) this._listeners.notify();
    return () => {
      for (const key of added) delete this._registered[key];
      this._listeners.notify();
    };
  }

  public destroy(): void {
    this._configUnsub?.();
    this._listeners.clear();
  }

  private _lookup(key: string): string {
    return this._overrides[key] ?? this._registered[key] ?? DEFAULT_LOCALE[key] ?? key;
  }

  private _applyOverrideFromConfig(): void {
    const override = (this._config.values as { localeDefinitionOverride?: unknown }).localeDefinitionOverride;
    const next =
      override && typeof override === 'object' && !Array.isArray(override) ? (override as Record<string, string>) : {};
    if (this._equalShallow(this._overrides, next)) return;
    this._overrides = next;
    this._listeners.notify();
  }

  private _equalShallow(a: Record<string, string>, b: Record<string, string>): boolean {
    const ak = Object.keys(a);
    const bk = Object.keys(b);
    if (ak.length !== bk.length) return false;
    return ak.every((k) => a[k] === b[k]);
  }
}
