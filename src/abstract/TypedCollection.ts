import { PubSub } from '../lit/PubSubCompat';
import { UID } from '../utils/UID';
import type { ExtractDataFromSchema, ExtractKeysFromSchema, TypedSchema } from './TypedData';
import { TypedData } from './TypedData';

type ChangeMap<T extends TypedSchema> = Record<keyof T, Set<string>>;
type Unsubscriber<T extends TypedSchema> = ReturnType<TypedData<T>['subscribe']>;
type TypedCollectionPropertyObserver<T extends TypedSchema> = (changeMap: ChangeMap<T>) => void;

export type TypedCollectionObserverHandler<T extends TypedSchema> = (
  list: string[],
  added: Set<TypedData<T>>,
  removed: Set<TypedData<T>>,
) => void;

type TypedCollectionOptions<T extends TypedSchema> = {
  typedSchema: T;
  watchList?: ExtractKeysFromSchema<T>[];
  handler?: TypedCollectionObserverHandler<T>;
  ctxName?: string;
};

export class TypedCollection<T extends TypedSchema> {
  private _typedSchema: T;
  private _ctxId: string;
  private _data: ReturnType<typeof PubSub.registerCtx>;
  private _watchList: ExtractKeysFromSchema<T>[];
  private _subsMap: Record<string, Unsubscriber<T>[]> = Object.create(null) as Record<string, Unsubscriber<T>[]>;
  private _propertyObservers = new Set<TypedCollectionPropertyObserver<T>>();
  private _collectionObservers = new Set<TypedCollectionObserverHandler<T>>();
  private _items = new Set<string>();
  private _removed = new Set<TypedData<T>>();
  private _added = new Set<TypedData<T>>();
  private _observeTimeout?: number;
  private _notifyTimeout?: number;
  private _notifyObservers: (propName: string, ctxId: string) => void;

  public constructor(options: TypedCollectionOptions<T>) {
    this._typedSchema = options.typedSchema;
    this._ctxId = options.ctxName || UID.generate();
    this._data = PubSub.registerCtx({}, this._ctxId);
    this._watchList = options.watchList || [];

    let changeMap = Object.create(null) as ChangeMap<T>;

    this._notifyObservers = (propName: keyof T, ctxId: string) => {
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
    });
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

  public add(init: Partial<ExtractDataFromSchema<T>>): string {
    const item = new TypedData(this._typedSchema);
    for (const [prop, value] of Object.entries(init) as [
      ExtractKeysFromSchema<T>,
      ExtractDataFromSchema<T>[ExtractKeysFromSchema<T>],
    ][]) {
      if (value !== undefined) {
        item.setValue(prop, value);
      }
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

  public read(id: string): TypedData<T> | null {
    return this._data.read(id) as TypedData<T> | null;
  }

  public readProp<K extends ExtractKeysFromSchema<T>>(id: string, propName: K): ExtractDataFromSchema<T>[K] | null {
    const item = this.read(id);
    if (!item) {
      console.warn(`Item with id ${id} not found`);
      return null;
    }
    return item.getValue(propName);
  }

  public publishProp<K extends ExtractKeysFromSchema<T>>(
    id: string,
    propName: K,
    value: ExtractDataFromSchema<T>[K],
  ): void {
    const item = this.read(id);
    if (!item) {
      console.warn(`Item with id ${id} not found`);
      return;
    }
    item.setValue(propName, value);
  }

  public remove(id: string): void {
    const item = this.read(id);
    if (item) {
      this._removed.add(item);
    }
    this._items.delete(id);
    this._notify();
    this._data.pub(id, null);
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

  public findItems(checkFn: (item: TypedData<T>) => boolean): string[] {
    const result: string[] = [];
    this._items.forEach((id) => {
      const item = this.read(id);
      if (item && checkFn(item)) {
        result.push(id);
      }
    });
    return result;
  }

  public items(): string[] {
    return [...this._items];
  }

  public get size(): number {
    return this._items.size;
  }

  public destroy(): void {
    PubSub.deleteCtx(this._ctxId);
    this._propertyObservers = new Set();
    this._collectionObservers = new Set();
    for (const id in this._subsMap) {
      this._subsMap[id]?.forEach((sub) => {
        sub.remove();
      });
      delete this._subsMap[id];
    }
  }
}
