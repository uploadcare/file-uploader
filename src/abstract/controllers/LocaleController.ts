import { SignalMap } from '../di/SignalMap';

/**
 * Pure-logic locale string store. Knows nothing about DOM or Lit.
 *
 * In the v1 → v2 strangler this is the source of truth for the `*l10n/*` state
 * that used to live in the per-ctx store map; the v1 ctx facade routes those
 * keys here. For now it is a raw string container: `LocaleManager` still owns
 * the orchestration (resolving the active dictionary from `localeName`,
 * `defineLocale` registry lookups, async resolvers, `localeDefinitionOverride`,
 * and plugin `registerL10n` merges) and writes the resolved strings here, and
 * `l10n.ts` reads from here to do ICU-plural + template substitution — so
 * behavior is byte-identical to v1. That orchestration migrates into this
 * controller when `LocaleManager` is retired.
 *
 * Backed by a composed `SignalMap` (has-a): `getTracked()` auto-tracks a single
 * key under a `SignalWatcher`, `get()` is the fast non-tracking read the
 * compat path uses, `set()` dedups unchanged writes and fires the map's coarse
 * notify, and `subscribe()` fans out on any change — preserving the per-key
 * change semantics the v1 ctx facade `*l10n/` routing depends on. A locale
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

  /**
   * Trackable read: returns the value and, under a `SignalWatcher`, subscribes
   * that consumer to this specific key. Use when a Lit reactive consumer must
   * re-render on a locale change; the compat path keeps using the fast,
   * non-tracking `get`.
   */
  public getTracked(key: string): string | undefined {
    return this.#values.signal(key).get();
  }

  /** Notifies only when the value actually changes (per-key change semantics). */
  public set(key: string, value: string): void {
    this.#values.set(key, value);
  }

  public destroy(): void {
    this.#values.destroy();
  }
}
