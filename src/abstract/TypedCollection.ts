import { Data, UID } from '@symbiotejs/symbiote';
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
  private __typedSchema: T;
  private __ctxId: string;
  private __data: ReturnType<typeof Data.registerCtx>;
  private __watchList: ExtractKeysFromSchema<T>[];
  private __subsMap: Record<string, Unsubscriber<T>[]> = Object.create(null) as Record<string, Unsubscriber<T>[]>;
  private __propertyObservers = new Set<TypedCollectionPropertyObserver<T>>();
  private __collectionObservers = new Set<TypedCollectionObserverHandler<T>>();
  private __items = new Set<string>();
  private __removed = new Set<TypedData<T>>();
  private __added = new Set<TypedData<T>>();
  private __observeTimeout?: number;
  private __notifyTimeout?: number;
  private __notifyObservers: (propName: string, ctxId: string) => void;

  constructor(options: TypedCollectionOptions<T>) {
    this.__typedSchema = options.typedSchema;
    this.__ctxId = options.ctxName || UID.generate();
    this.__data = Data.registerCtx({}, this.__ctxId);
    this.__watchList = options.watchList || [];

    let changeMap = Object.create(null) as ChangeMap<T>;

    this.__notifyObservers = (propName: keyof T, ctxId: string) => {
      if (this.__observeTimeout) {
        window.clearTimeout(this.__observeTimeout);
      }
      if (!changeMap[propName]) {
        changeMap[propName] = new Set();
      }
      changeMap[propName].add(ctxId);
      this.__observeTimeout = window.setTimeout(() => {
        if (Object.keys(changeMap).length === 0) {
          return;
        }
        this.__propertyObservers.forEach((handler) => {
          handler({ ...changeMap });
        });
        changeMap = Object.create(null) as ChangeMap<T>;
      });
    };

    if (options.handler) {
      this.observeCollection(options.handler);
    }
  }

  notify(): void {
    if (this.__notifyTimeout) {
      window.clearTimeout(this.__notifyTimeout);
    }
    this.__notifyTimeout = window.setTimeout(() => {
      const added = new Set(this.__added);
      const removed = new Set(this.__removed);
      this.__added.clear();
      this.__removed.clear();
      for (const handler of this.__collectionObservers) {
        handler?.([...this.__items], added, removed);
      }
    });
  }

  observeCollection(handler: TypedCollectionObserverHandler<T>): () => void {
    this.__collectionObservers.add(handler);

    if (this.__items.size > 0) {
      this.notify();
    }

    return () => {
      this.unobserveCollection(handler);
    };
  }

  unobserveCollection(handler: TypedCollectionObserverHandler<T>): void {
    this.__collectionObservers.delete(handler);
  }

  add(init: Partial<ExtractDataFromSchema<T>>): string {
    const item = new TypedData(this.__typedSchema);
    for (const [prop, value] of Object.entries(init) as [
      ExtractKeysFromSchema<T>,
      ExtractDataFromSchema<T>[ExtractKeysFromSchema<T>],
    ][]) {
      if (value !== undefined) {
        item.setValue(prop, value);
      }
    }
    this.__items.add(item.uid);
    this.notify();

    this.__data.add(item.uid, item);
    this.__added.add(item);
    this.__watchList.forEach((propName) => {
      if (!this.__subsMap[item.uid]) {
        this.__subsMap[item.uid] = [];
      }
      this.__subsMap[item.uid]?.push(
        item.subscribe(propName, () => {
          this.__notifyObservers(propName, item.uid);
        }),
      );
    });
    return item.uid;
  }

  read(id: string): TypedData<T> | null {
    return this.__data.read(id);
  }

  readProp<K extends ExtractKeysFromSchema<T>>(id: string, propName: K): ExtractDataFromSchema<T>[K] | null {
    const item = this.read(id);
    if (!item) {
      console.warn(`Item with id ${id} not found`);
      return null;
    }
    return item.getValue(propName);
  }

  publishProp<K extends ExtractKeysFromSchema<T>>(id: string, propName: K, value: ExtractDataFromSchema<T>[K]): void {
    const item = this.read(id);
    if (!item) {
      console.warn(`Item with id ${id} not found`);
      return;
    }
    item.setValue(propName, value);
  }

  remove(id: string): void {
    const item = this.read(id);
    if (item) {
      this.__removed.add(item);
    }
    this.__items.delete(id);
    this.notify();
    this.__data.pub(id, null);
    delete this.__subsMap[id];
  }

  clearAll(): void {
    this.__items.forEach((id) => {
      this.remove(id);
    });
  }

  observeProperties(handler: TypedCollectionPropertyObserver<T>): () => void {
    this.__propertyObservers.add(handler);

    return () => {
      this.unobserveProperties(handler);
    };
  }

  unobserveProperties(handler: TypedCollectionPropertyObserver<T>): void {
    this.__propertyObservers.delete(handler);
  }

  findItems(checkFn: (item: TypedData<T>) => boolean): string[] {
    const result: string[] = [];
    this.__items.forEach((id) => {
      const item = this.read(id);
      if (item && checkFn(item)) {
        result.push(id);
      }
    });
    return result;
  }

  items(): string[] {
    return [...this.__items];
  }

  get size(): number {
    return this.__items.size;
  }

  destroy(): void {
    Data.deleteCtx(this.__ctxId);
    this.__propertyObservers = new Set();
    this.__collectionObservers = new Set();
    for (const id in this.__subsMap) {
      this.__subsMap[id]?.forEach((sub) => {
        sub.remove();
      });
      delete this.__subsMap[id];
    }
  }
}
