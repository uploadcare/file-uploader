import { SignalMap } from '../di/SignalMap';

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
 *
 * Backed by a composed `SignalMap` (has-a): reads auto-track under a
 * `SignalWatcher`, `set()` dedups unchanged writes and fires the map's coarse
 * notify, and `subscribe()` fans out on any change — preserving the per-key
 * change semantics the `PubSubCompat` `*l10n/` routing depends on. A locale
 * key named `__proto__` is an ordinary map key, never a prototype write.
 */
export class LocaleController {
  #values = new SignalMap<Record<string, string>>();

  public get values(): Readonly<Record<string, string>> {
    return this.#values.values;
  }

  public subscribe(listener: () => void): () => void {
    return this.#values.subscribe(listener);
  }

  public has(key: string): boolean {
    return this.#values.has(key);
  }

  public get(key: string): string | undefined {
    return this.#values.get(key);
  }

  /** Notifies only when the value actually changes (per-key change semantics). */
  public set(key: string, value: string): void {
    this.#values.set(key, value);
  }

  public destroy(): void {
    this.#values.destroy();
  }
}
