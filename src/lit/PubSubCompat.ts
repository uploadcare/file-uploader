import { listenKeys, type MapStore, map } from 'nanostores';

export type Subscription = {
  remove: () => void;
};

const contexts = new Map<string, MapStore<Record<string, unknown>>>();

export class PubSub<T extends Record<string, unknown> = Record<string, unknown>> {
  private _store: MapStore<T>;

  private constructor(_ctxId: string, store: MapStore<T>) {
    this._store = store;
  }

  public pub<K extends keyof T>(key: K, value: T[K]): void {
    if (!(key in this._store.get())) {
      console.warn(`PubSub#pub: Key "${String(key)}" not found`);
    }
    this._store.setKey(key as never, value as never);
  }

  public sub<K extends keyof T>(key: K, callback: (value: T[K]) => void, init = true): Subscription {
    if (!(key in this._store.get())) {
      console.warn(`PubSub#sub: Key "${String(key)}" not found`);
    }

    if (init) {
      callback(this._store.get()[key]);
    }

    const unsubscribe = listenKeys(this._store, [key as any], (values: Partial<T>) => {
      callback(values[key] as T[K]);
    });

    return {
      remove: unsubscribe,
    };
  }

  public read<K extends keyof T>(key: K): T[K] {
    if (!(key in this._store.get())) {
      console.warn(`PubSub#read: Key "${String(key)}" not found`);
    }
    return this._store.get()[key];
  }

  public add<K extends keyof T>(key: K, value: T[K], rewrite = false): void {
    const exists = key in this._store.get();

    if (!exists || rewrite) {
      // biome-ignore lint/suspicious/noExplicitAny: nanostores doesn't export AllKeys type that they use to resolve setKey param type
      this._store.setKey(key as any, value as any);
    }
  }

  public has(key: keyof T): boolean {
    return key in this._store.get();
  }

  public get store(): T {
    return this._store.get();
  }

  public static registerCtx<T extends Record<string, unknown>>(initialValue: T, ctxId: string): PubSub<T> {
    if (contexts.has(ctxId)) {
      throw new Error(`PubSub: Context with id "${ctxId}" already exists`);
    }

    const store = map<T>(initialValue);

    contexts.set(ctxId, store as MapStore<Record<string, unknown>>);
    return new PubSub<T>(ctxId, store);
  }

  public static deleteCtx(ctxId: string): void {
    contexts.delete(ctxId);
  }

  public static getCtx<T extends Record<string, unknown> = Record<string, unknown>>(ctxId: string): PubSub<T> | null {
    const store = contexts.get(ctxId);
    if (!store) {
      return null;
    }
    return new PubSub<T>(ctxId, store as MapStore<T>);
  }

  public static hasCtx(ctxId: string): boolean {
    return contexts.has(ctxId);
  }
}
