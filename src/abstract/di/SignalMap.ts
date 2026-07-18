import { type Signal, signal } from '@lit-labs/signals';
import { Listeners } from '../host-subscription';

/**
 * DOM-free reactive key/value store for controllers with a DYNAMIC keyspace —
 * `ConfigController` (~55 built-ins plus plugin-registered keys) and
 * `LocaleController` (arbitrary locale strings). It is the has-a counterpart to
 * the per-static-field `@signalState` decorator (which can't model a keyspace
 * that grows at runtime).
 *
 * A null-prototype `#bag` is the authoritative store — it holds every value,
 * defines key presence, and is returned live by `values` (byte-for-byte with
 * the `StateController._state` reference this replaces, so a consumer that
 * captured `config.values` once still observes later writes). Writes dedup with
 * `Object.is` and, on a real change, fire a COARSE `Listeners` notify (any-key
 * granularity) — the exact contract the v1 per-key derived subscriptions and
 * `ChildBlock.subConfigValue` lean on. No `lit`, no DOM.
 *
 * Reactive layer: `signal(key)` lazily materializes a per-key
 * `@lit-labs/signals` `Signal.State` (seeded from the bag, kept in sync by
 * `set`), so a future `SignalWatcher` consumer can auto-track a specific key.
 * The plain `get(key)` deliberately reads the bag directly rather than routing
 * every access through `Signal.State.get()` — config is on an extremely hot
 * read path (every `api.cfg` lookup, every render), and no `SignalWatcher`
 * consumer exists yet, so per-read signal overhead would be a pure regression
 * (it measurably destabilizes the parallel e2e suite). Reads migrate to
 * `signal(key)` when the first reactive consumer lands.
 *
 * The bag is null-proto and keys live by their string name, so a plugin/locale
 * key named `__proto__` is an ordinary own property, never a prototype write.
 */
export class SignalMap<T extends object> {
  // Authoritative value + presence store, and the live view returned by `values`.
  #bag: T = Object.create(null);
  // Lazily-populated per-key signals (created on first `get`), kept in sync with
  // `#bag` on write. Stored as `Signal.State<unknown>` — an erasure boundary,
  // cast back at the typed `get`/`set` edges (each is keyed by its own key).
  #signals = new Map<keyof T, Signal.State<unknown>>();
  #listeners = new Listeners();

  /** Seed initial key/values into the bag without notifying (construction defaults). */
  public constructor(initial?: Readonly<Partial<T>>) {
    if (initial) {
      for (const key of Object.keys(initial) as (keyof T)[]) {
        this.#bag[key] = initial[key] as T[keyof T];
      }
    }
  }

  /**
   * Fast, non-tracking read from the bag. Returns `undefined` for a key that was
   * never seeded or set (byte-for-byte with `StateController.get` /
   * `LocaleController.get`). Use `signal(key).get()` when reactive tracking is
   * needed.
   */
  public get<K extends keyof T>(key: K): T[K] | undefined {
    return Object.hasOwn(this.#bag, key) ? this.#bag[key] : undefined;
  }

  /**
   * The per-key reactive signal (lazily materialized from the bag, kept in sync
   * by `set`). Reading it under a `SignalWatcher` auto-tracks that key. Present
   * for the forward migration; the compat read path uses the plain `get`.
   */
  public signal<K extends keyof T>(key: K): Signal.State<T[K] | undefined> {
    let s = this.#signals.get(key);
    if (!s) {
      s = signal<unknown>(Object.hasOwn(this.#bag, key) ? this.#bag[key] : undefined);
      this.#signals.set(key, s);
    }
    return s as Signal.State<T[K] | undefined>;
  }

  public has(key: keyof T): boolean {
    return Object.hasOwn(this.#bag, key);
  }

  /** `Object.is` dedup; on a real change, updates the bag (+ any live signal) then coarse-notifies. */
  public set<K extends keyof T>(key: K, value: T[K]): void {
    // Dedup only when the key already EXISTS with an equal value. An absent key
    // must never be treated as a present `undefined`: otherwise `set(key,
    // undefined)` would no-op and never materialize the key, so a caller like
    // `ConfigController.register` could not replace an explicit pre-registration
    // `undefined` write. `Object.is` dedup is byte-for-byte with the v1
    // `StateController.set` / `LocaleController.set` semantics.
    if (Object.hasOwn(this.#bag, key) && Object.is(this.#bag[key], value)) {
      return;
    }
    this.#bag[key] = value;
    // Only push into the signal if it was already materialized; an untouched
    // key stays lazy and its next `get` seeds from the now-updated bag.
    this.#signals.get(key)?.set(value);
    this.#listeners.notify();
  }

  /**
   * Seed a key into the bag WITHOUT notifying, only if absent — for a
   * default-seeding caller (`ConfigController.register`) that fires its own
   * single coarse notify after.
   */
  public seed<K extends keyof T>(key: K, value: T[K]): void {
    if (!Object.hasOwn(this.#bag, key)) {
      this.#bag[key] = value;
      // Keep an already-materialized signal in lockstep with the bag, same as `set` —
      // otherwise a `signal(key)` consumer created before this key is seeded would go stale.
      this.#signals.get(key)?.set(value);
    }
  }

  public subscribe(listener: () => void): () => void {
    return this.#listeners.subscribe(listener);
  }

  /** Coarse notify with no state change — for a keyed store's owner to force it. */
  public notify(): void {
    this.#listeners.notify();
  }

  /**
   * The live value bag (a stable reference, mutated in place on write) — matches
   * the v1 `StateController._state` semantics exactly.
   */
  public get values(): T {
    return this.#bag;
  }

  public destroy(): void {
    this.#signals.clear();
    this.#bag = Object.create(null);
    this.#listeners.clear();
  }
}
