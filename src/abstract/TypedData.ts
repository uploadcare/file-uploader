import type { Uid } from '../lit/Uid';
import { UID } from '../utils/UID';

const MSG_NAME = '[Typed State] Wrong property name: ';

/**
 * Per-entry reactive store. Each upload entry is one `TypedData`.
 *
 * As of the v1 → v2 strangler (M3a) this is self-contained — a plain
 * null-prototype field object plus per-key listener sets — rather than a
 * nanostores `PubSub` context per entry. A module-level registry keyed by the
 * entry's `uid` replaces the old `PubSub.getCtx(uid)` lookup that hot paths
 * (`getOutputItem`, event emission) used to read entry state by id; because
 * the collection defers `destroy()` ~10s after removal, `getByUid` keeps
 * returning a removed entry's data during that window, exactly as the old
 * per-entry context did.
 *
 * Public API (`uid`, `getValue`, `setValue`, `setMultipleValues`, `subscribe`,
 * `destroy`) is unchanged, so the collection and all consumers are
 * untouched. `subscribe` fires immediately with the current value, matching
 * the previous `PubSub.sub(..., init=true)` behavior.
 */
export class TypedData<T extends Record<string, unknown>> {
  private static _registry = new Map<string, TypedData<Record<string, unknown>>>();

  private _ctxId: Uid;
  private _data: T;
  private _subs = new Map<keyof T, Set<(value: unknown) => void>>();

  public constructor(initialValue: T) {
    this._ctxId = UID.generateFastUid();
    // Null-prototype so a field name like `__proto__` can't touch the chain.
    this._data = Object.assign(Object.create(null), initialValue);
    TypedData._registry.set(this._ctxId, this as unknown as TypedData<Record<string, unknown>>);
  }

  /** Look up a live entry store by its uid (returns removed-but-not-yet-destroyed entries too). */
  public static getByUid<T extends Record<string, unknown>>(uid: string): TypedData<T> | null {
    return (TypedData._registry.get(uid) as TypedData<T> | undefined) ?? null;
  }

  public get uid(): Uid {
    return this._ctxId;
  }

  /** Full current field object — the replacement for the old `PubSub#store`. */
  public snapshot(): Readonly<T> {
    return this._data;
  }

  public setValue<K extends keyof T>(prop: K, value: T[K]): void {
    if (!Object.hasOwn(this._data, prop as PropertyKey)) {
      console.warn(`${MSG_NAME}${String(prop)}`);
      return;
    }
    if (this._data[prop] === value) {
      return;
    }
    this._data[prop] = value;
    const set = this._subs.get(prop);
    if (set) {
      // Isolate each subscriber so one that throws can't abort notification of
      // the rest — notably the collection watch-list observer, whose
      // failure to run would stall collection/event updates. Matches the
      // fan-out semantics of `Listeners.notify` / `EventBus.emit`.
      for (const handler of [...set]) this._emit(prop, handler, value);
    }
  }

  /** Invoke a subscriber, isolating (and logging) any error it throws. */
  private _emit(prop: keyof T, handler: (value: unknown) => void, value: unknown): void {
    try {
      handler(value);
    } catch (err) {
      console.warn(`[Typed State] subscriber for "${String(prop)}" threw`, err);
    }
  }

  public setMultipleValues(updObj: Partial<T>): void {
    for (const [prop, value] of Object.entries(updObj)) {
      this.setValue(prop as keyof T, value as T[keyof T]);
    }
  }

  public getValue<K extends keyof T>(prop: K): T[K] {
    if (!Object.hasOwn(this._data, prop as PropertyKey)) {
      console.warn(`${MSG_NAME}${String(prop)}`);
    }
    return this._data[prop];
  }

  public subscribe<K extends keyof T>(prop: K, handler: (newVal: T[K]) => void): () => void {
    let set = this._subs.get(prop);
    if (!set) {
      set = new Set();
      this._subs.set(prop, set);
    }
    const wrapped = handler as (value: unknown) => void;
    set.add(wrapped);
    // Fire immediately with the current value (parity with the previous
    // `PubSub.sub(..., init=true)` subscription semantics), isolated like the
    // notify path so a throwing subscriber can't break the subscribe call.
    this._emit(prop, wrapped, this._data[prop]);
    return () => {
      set?.delete(wrapped);
    };
  }

  public destroy(): void {
    TypedData._registry.delete(this._ctxId);
    this._subs.clear();
  }
}
