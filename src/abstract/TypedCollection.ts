import { PubSub } from '../lit/PubSubCompat';
import type { Uid } from '../lit/Uid';
import { UID } from '../utils/UID';
import { TypedData } from './TypedData';

type ChangeMap<T extends Record<string, unknown>> = Record<keyof T, Set<Uid>>;
type Unsubscriber<T extends Record<string, unknown>> = ReturnType<TypedData<T>['subscribe']>;
type TypedCollectionPropertyObserver<T extends Record<string, unknown>> = (changeMap: ChangeMap<T>) => void;

export type TypedCollectionObserverHandler<T extends Record<string, unknown>> = (
  list: Uid[],
  added: Set<TypedData<T>>,
  removed: Set<TypedData<T>>,
) => void;

type TypedCollectionOptions<T extends Record<string, unknown>> = {
  initialValue: T;
  watchList?: (keyof T)[];
  handler?: TypedCollectionObserverHandler<T>;
};

type TypedDataMap<T extends Record<string, unknown>> = Record<Uid, TypedData<T> | undefined>;

export class TypedCollection<T extends Record<string, unknown>> {
  private static readonly _destroyDelayMs = 10_000;

  private _ctxId: Uid;
  private _data: PubSub<TypedDataMap<T>>;
  private _watchList: (keyof T)[];
  private _subsMap: Record<Uid, Unsubscriber<T>[]> = Object.create(null) as Record<Uid, Unsubscriber<T>[]>;
  private _propertyObservers = new Set<TypedCollectionPropertyObserver<T>>();
  private _collectionObservers = new Set<TypedCollectionObserverHandler<T>>();
  private _items = new Set<Uid>();
  private _removed = new Set<TypedData<T>>();
  private _added = new Set<TypedData<T>>();
  private _markedToDestroy = new Set<TypedData<T>>();
  private _observeTimeout?: number;
  private _notifyTimeout?: number;
  private _destroyTimeout?: number;
  private _notifyObservers: (propName: keyof T, ctxId: Uid) => void;
  private _initialValue: T;

  public constructor(options: TypedCollectionOptions<T>) {
    this._initialValue = options.initialValue;
    this._ctxId = UID.generateFastUid();
    this._data = PubSub.registerCtx<TypedDataMap<T>>({}, this._ctxId);
    this._watchList = options.watchList || [];

    let changeMap = Object.create(null) as ChangeMap<T>;

    this._notifyObservers = (propName: keyof T, ctxId: Uid) => {
      if (this._observeTimeout) {
        window.clearTimeout(this._observeTimeout);
      }
      if (!changeMap[propName]) {
        changeMap[propName] = new Set();
      }
      changeMap[propName].add(ctxId);
      this._observeTimeout = window.setTimeout(() => {
        if (Object.keys(changeMap).length === 0) {
          return;
        }
        this._propertyObservers.forEach((handler) => {
          handler({ ...changeMap });
        });
        changeMap = Object.create(null) as ChangeMap<T>;
      });
      this._scheduleDestroyMarkedItems();
    };

    if (options.handler) {
      this.observeCollection(options.handler);
    }
  }

  private _notify(): void {
    if (this._notifyTimeout) {
      window.clearTimeout(this._notifyTimeout);
    }
    this._notifyTimeout = window.setTimeout(() => {
      const added = new Set(this._added);
      const removed = new Set(this._removed);
      this._added.clear();
      this._removed.clear();
      for (const handler of this._collectionObservers) {
        handler?.([...this._items], added, removed);
      }

      this._scheduleDestroyMarkedItems();
    });
  }

  private _scheduleDestroyMarkedItems(): void {
    if (this._markedToDestroy.size === 0) {
      return;
    }
    if (this._destroyTimeout) {
      window.clearTimeout(this._destroyTimeout);
    }
    this._destroyTimeout = window.setTimeout(() => {
      const marked = [...this._markedToDestroy];
      this._markedToDestroy.clear();
      for (const item of marked) {
        item.destroy();
      }
    }, TypedCollection._destroyDelayMs);
  }

  public observeCollection(handler: TypedCollectionObserverHandler<T>): () => void {
    this._collectionObservers.add(handler);

    if (this._items.size > 0) {
      this._notify();
    }

    return () => {
      this.unobserveCollection(handler);
    };
  }

  public unobserveCollection(handler: TypedCollectionObserverHandler<T>): void {
    this._collectionObservers.delete(handler);
  }

  public add(init: Partial<T>): Uid {
    const item = new TypedData<T>(this._initialValue);
    for (const [prop, value] of Object.entries(init) as [keyof T, T[keyof T]][]) {
      item.setValue(prop, value);
    }
    this._items.add(item.uid);
    this._notify();

    this._data.add(item.uid, item);
    this._added.add(item);
    this._watchList.forEach((propName) => {
      if (!this._subsMap[item.uid]) {
        this._subsMap[item.uid] = [];
      }
      this._subsMap[item.uid]?.push(
        item.subscribe(propName, () => {
          this._notifyObservers(propName, item.uid);
        }),
      );
    });
    return item.uid;
  }

  public hasItem(id: Uid): boolean {
    return this._items.has(id);
  }

  public read(id: Uid): TypedData<T> | null {
    return this._data.read(id) ?? null;
  }

  public readProp<K extends keyof T>(id: Uid, propName: K): T[K] {
    const item = this.read(id);
    if (!item) {
      throw new Error(`TypedCollection#readProp: Item with id ${id} not found`);
    }
    return item.getValue(propName);
  }

  public publishProp<K extends keyof T>(id: Uid, propName: K, value: T[K]): void {
    const item = this.read(id);
    if (!item) {
      throw new Error(`TypedCollection#publishProp: Item with id ${id} not found`);
    }
    item.setValue(propName, value);
  }

  public remove(id: Uid): void {
    const item = this.read(id);
    if (item) {
      this._removed.add(item);
      this._markedToDestroy.add(item);
    }
    this._items.delete(id);
    this._notify();
    this._data.pub(id, undefined);

    this._subsMap[id]?.forEach((sub) => {
      sub.remove();
    });
    delete this._subsMap[id];
  }

  public clearAll(): void {
    this._items.forEach((id) => {
      this.remove(id);
    });
  }

  public observeProperties(handler: TypedCollectionPropertyObserver<T>): () => void {
    this._propertyObservers.add(handler);

    return () => {
      this.unobserveProperties(handler);
    };
  }

  public unobserveProperties(handler: TypedCollectionPropertyObserver<T>): void {
    this._propertyObservers.delete(handler);
  }

  public findItems(checkFn: (item: TypedData<T>) => boolean): Uid[] {
    const result: Uid[] = [];
    this._items.forEach((id) => {
      const item = this.read(id);
      if (item && checkFn(item)) {
        result.push(id);
      }
    });
    return result;
  }

  public items(): Uid[] {
    return [...this._items];
  }

  public get size(): number {
    return this._items.size;
  }

  public destroy(): void {
    if (this._observeTimeout) {
      window.clearTimeout(this._observeTimeout);
    }
    if (this._notifyTimeout) {
      window.clearTimeout(this._notifyTimeout);
    }
    if (this._destroyTimeout) {
      window.clearTimeout(this._destroyTimeout);
    }

    for (const item of this._markedToDestroy) {
      item.destroy();
    }
    this._markedToDestroy.clear();

    PubSub.deleteCtx(this._ctxId);
    this._propertyObservers = new Set();
    this._collectionObservers = new Set();
    for (const id of Object.keys(this._subsMap) as Uid[]) {
      this._subsMap[id]?.forEach((sub) => {
        sub.remove();
      });
      delete this._subsMap[id];
    }
  }
}
