import type { ObserveOptions } from '../host-subscription';

/**
 * The shared contract for the codebase's keyed reactive value stores. Satisfied
 * by BOTH the signal-backed `SignalMap` (`getTracked` = signal read, `observe` =
 * `Listeners.observe`) and a `Listeners`-backed store (`getTracked` ≡ `get`,
 * `observe` = `Listeners.observe`), so the surface unifies regardless of backing.
 *
 * `get`/`getTracked` are typed `T[K] | undefined` (the honest lower bound for a
 * dynamic keyspace); an always-seeded implementer may narrow its own return to
 * `T[K]` and still satisfy this interface (return-type covariance).
 */
export interface ReactiveStore<T extends object> {
  /** Fast, non-tracking read from the value bag. */
  get<K extends keyof T>(key: K): T[K] | undefined;
  /** Trackable read: under a `SignalWatcher` this subscribes the consumer to `key`. */
  getTracked<K extends keyof T>(key: K): T[K] | undefined;
  /** Set one key; `Object.is` dedup, coarse notify on real change. */
  set<K extends keyof T>(key: K, value: T[K]): void;
  /** Set several keys at once; per-key `Object.is` dedup, ONE coalesced coarse notify. */
  setMany(patch: Partial<T>): void;
  /** Coarse subscribe — fires on any change, not per-key. */
  subscribe(listener: () => void): () => void;
  /** Atomic per-key subscription (`Object.is` dedup); `{ immediate }` also fires once now. */
  observe<K extends keyof T>(key: K, listener: (value: T[K] | undefined) => void, options?: ObserveOptions): () => void;
  /** The live value bag (stable reference, mutated in place on write). */
  get values(): Readonly<T>;
  /** Coarse notify with no state change. */
  notify(): void;
  destroy(): void;
}
