import type { Uid } from '../lit/Uid';
import { UID } from '../utils/UID';
import type { ReactiveStore } from './di/ReactiveStore';
import { SignalMap } from './di/SignalMap';
import type { ObserveOptions } from './host-subscription';
import { logger } from './logger';

const log = logger.scope('typed-data');
const MSG_NAME = '[Typed State] Wrong property name: ';

/**
 * Per-entry reactive store. Each upload entry is one `TypedData`.
 *
 * Composes a `SignalMap` (the same keyed reactive store backing
 * `ConfigController`/`LocaleController`) rather than hand-rolling its own
 * per-key `Set` bookkeeping, so it gets the canonical `ReactiveStore<T>`
 * surface (`get`/`set`/`setMany`/`values`/`subscribe`/`observe`/`getTracked`/
 * `notify`/`destroy`) — plus this class's own module-level `uid` registry,
 * which replaces the old per-entry `PubSub.getCtx(uid)` lookup that hot paths
 * (`getOutputItem`, event emission) use to read entry state by id. Because the
 * collection defers `destroy()` ~10s after removal, `getByUid` keeps
 * returning a removed entry's data during that window, exactly as before.
 *
 * The old immediate per-key `subscribe(prop, handler)` form has been removed;
 * callers use `observe(key, handler, { immediate: true })` instead.
 */
export class TypedData<T extends Record<string, unknown>> implements ReactiveStore<T> {
  private static _registry = new Map<string, TypedData<Record<string, unknown>>>();

  private _uid: Uid;
  #store: SignalMap<T>;

  public constructor(initialValue: T) {
    this._uid = UID.generateFastUid();
    this.#store = new SignalMap<T>(initialValue);
    TypedData._registry.set(this._uid, this as unknown as TypedData<Record<string, unknown>>);
  }

  /** Look up a live entry store by its uid (returns removed-but-not-yet-destroyed entries too). */
  public static getByUid<T extends Record<string, unknown>>(uid: string): TypedData<T> | null {
    return (TypedData._registry.get(uid) as TypedData<T> | undefined) ?? null;
  }

  public get uid(): Uid {
    return this._uid;
  }

  /** Live field object — the former `snapshot()`. */
  public get values(): Readonly<T> {
    return this.#store.values;
  }

  public get<K extends keyof T>(key: K): T[K] {
    if (!this.#store.has(key)) {
      log.warn(`${MSG_NAME}${String(key)}`);
    }
    return this.#store.get(key) as T[K];
  }

  public getTracked<K extends keyof T>(key: K): T[K] {
    return this.#store.getTracked(key) as T[K];
  }

  public set<K extends keyof T>(key: K, value: T[K]): void {
    if (!this.#store.has(key)) {
      log.warn(`${MSG_NAME}${String(key)}`);
      return;
    }
    this.#store.set(key, value);
  }

  public setMany(patch: Partial<T>): void {
    const known: Partial<T> = {};
    for (const key of Object.keys(patch) as (keyof T)[]) {
      if (!this.#store.has(key)) {
        log.warn(`${MSG_NAME}${String(key)}`);
        continue;
      }
      known[key] = patch[key];
    }
    this.#store.setMany(known);
  }

  public subscribe(listener: () => void): () => void {
    return this.#store.subscribe(listener);
  }

  public observe<K extends keyof T>(
    key: K,
    listener: (value: T[K] | undefined) => void,
    options?: ObserveOptions,
  ): () => void {
    return this.#store.observe(key, listener, options);
  }

  public notify(): void {
    this.#store.notify();
  }

  public destroy(): void {
    TypedData._registry.delete(this._uid);
    this.#store.destroy();
  }
}
