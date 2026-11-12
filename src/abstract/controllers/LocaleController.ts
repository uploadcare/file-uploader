import { SignalMap } from '../di/SignalMap';

/**
 * Pure-logic locale string store. Knows nothing about DOM or Lit.
 *
 * A raw string container: `LocaleManager` owns the orchestration (resolving
 * the active dictionary from `localeName`, `defineLocale` registry lookups,
 * async resolvers, `localeDefinitionOverride`, and plugin `registerL10n`
 * merges) and writes the resolved strings here, and `l10n.ts` reads from here
 * to do ICU-plural + template substitution.
 *
 * Backed by a composed `SignalMap` (has-a): `getTracked()` auto-tracks a single
 * key under a `SignalWatcher`, `get()` is the fast non-tracking read, and
 * `set()` dedups unchanged writes. A locale key named `__proto__` is an
 * ordinary map key, never a prototype write.
 */
export class LocaleController {
  #values = new SignalMap<Record<string, string>>();

  public has(key: string): boolean {
    return this.#values.has(key);
  }

  public get(key: string): string | undefined {
    return this.#values.get(key);
  }

  /**
   * Trackable read: returns the value and, under a `SignalWatcher`, subscribes
   * that consumer to this specific key. Use when a Lit reactive consumer must
   * re-render on a locale change; imperative reads use the fast, non-tracking
   * `get`.
   */
  public getTracked(key: string): string | undefined {
    return this.#values.getTracked(key);
  }

  /** Notifies only when the value actually changes (per-key change semantics). */
  public set(key: string, value: string): void {
    this.#values.set(key, value);
  }

  public destroy(): void {
    this.#values.destroy();
  }
}
