import { Listeners } from '../host-subscription';

/**
 * Pure-logic locale string store. Knows nothing about DOM or Lit.
 *
 * In the v1 → v2 strangler this is the source of truth for the `*l10n/*` state
 * that used to live in the per-ctx nanostores map; `PubSubCompat` routes those
 * keys here. For now it is a raw string container: `LocaleManager` still owns
 * the orchestration (resolving the active dictionary from `localeName`,
 * `defineLocale` registry lookups, async resolvers, `localeDefinitionOverride`,
 * and plugin `registerL10n` merges) and writes the resolved strings here, and
 * `l10n.ts` reads from here to do ICU-plural + template substitution — so
 * behavior is byte-identical to v1. That orchestration migrates into this
 * controller when `LocaleManager` is retired.
 */
export class LocaleController {
  private _values: Record<string, string> = {};
  private _listeners = new Listeners();

  public get values(): Readonly<Record<string, string>> {
    return this._values;
  }

  public subscribe(listener: () => void): () => void {
    return this._listeners.subscribe(listener);
  }

  public has(key: string): boolean {
    return key in this._values;
  }

  public get(key: string): string | undefined {
    return this._values[key];
  }

  /** Notifies only when the value actually changes (per-key change semantics). */
  public set(key: string, value: string): void {
    if (this._values[key] === value) return;
    this._values[key] = value;
    this._listeners.notify();
  }

  public destroy(): void {
    this._values = {};
    this._listeners.clear();
  }
}
