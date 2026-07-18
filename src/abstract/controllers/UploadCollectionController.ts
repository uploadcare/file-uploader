import type { Uid } from '../../lit/Uid';
import { TypedData } from '../TypedData';
import { initialUploadEntryData, type UploadEntryData } from '../uploadEntrySchema';

/** Entry properties whose changes drive the property observer (v1 parity). */
export const UPLOAD_WATCH_LIST: (keyof UploadEntryData)[] = [
  'file',
  'uploadProgress',
  'uploadError',
  'fileInfo',
  'errors',
  'cdnUrl',
  'isUploading',
  'isValidationPending',
];

export type UploadCollectionChangeMap = Partial<Record<keyof UploadEntryData, Set<Uid>>>;
type Unsubscriber = () => void;
export type PropertyObserver = (changeMap: UploadCollectionChangeMap) => void;
export type CollectionObserver = (
  list: Uid[],
  added: Set<TypedData<UploadEntryData>>,
  removed: Set<TypedData<UploadEntryData>>,
) => void;

/**
 * DOM-free upload collection — the per-ctx source of truth for the set of
 * upload entries, resolved from the `ControllerContainer`.
 *
 * This is the v2 rewrite of v1's `TypedCollection`: identical observation
 * semantics (one-tick-debounced collection + property observers, a watch-list
 * change-map, and a ~10s deferred destroy of removed entries) but backed by a
 * plain `Map<uid, TypedData>` instead of a per-ctx store `PubSub` context, and
 * using global timers so it runs without a DOM. Entries are `TypedData`
 * instances (already DOM-free as of M3a). The public API mirrors the former
 * `TypedCollection` (now removed) for drop-in parity with its consumers.
 */
export class UploadCollectionController {
  private static readonly _destroyDelayMs = 10_000;

  private _data = new Map<Uid, TypedData<UploadEntryData>>();
  private _subsMap = new Map<Uid, Unsubscriber[]>();
  private _propertyObservers = new Set<PropertyObserver>();
  private _collectionObservers = new Set<CollectionObserver>();
  private _items = new Set<Uid>();
  private _removed = new Set<TypedData<UploadEntryData>>();
  private _added = new Set<TypedData<UploadEntryData>>();
  private _markedToDestroy = new Set<TypedData<UploadEntryData>>();
  private _observeTimeout?: ReturnType<typeof setTimeout>;
  private _notifyTimeout?: ReturnType<typeof setTimeout>;
  private _destroyTimeout?: ReturnType<typeof setTimeout>;
  private _changeMap: UploadCollectionChangeMap = Object.create(null);

  private _notifyObservers(propName: keyof UploadEntryData, ctxId: Uid): void {
    if (this._observeTimeout) {
      clearTimeout(this._observeTimeout);
    }
    let set = this._changeMap[propName];
    if (!set) {
      set = new Set();
      this._changeMap[propName] = set;
    }
    set.add(ctxId);
    this._observeTimeout = setTimeout(() => {
      if (Object.keys(this._changeMap).length === 0) {
        return;
      }
      const changeMap = this._changeMap;
      this._changeMap = Object.create(null);
      for (const handler of this._propertyObservers) {
        handler({ ...changeMap });
      }
    });
    this._scheduleDestroyMarkedItems();
  }

  private _notify(): void {
    if (this._notifyTimeout) {
      clearTimeout(this._notifyTimeout);
    }
    this._notifyTimeout = setTimeout(() => {
      const added = new Set(this._added);
      const removed = new Set(this._removed);
      this._added.clear();
      this._removed.clear();
      for (const handler of this._collectionObservers) {
        handler([...this._items], added, removed);
      }
      this._scheduleDestroyMarkedItems();
    });
  }

  private _scheduleDestroyMarkedItems(): void {
    if (this._markedToDestroy.size === 0) {
      return;
    }
    if (this._destroyTimeout) {
      clearTimeout(this._destroyTimeout);
    }
    this._destroyTimeout = setTimeout(() => {
      const marked = [...this._markedToDestroy];
      this._markedToDestroy.clear();
      for (const item of marked) {
        item.destroy();
      }
    }, UploadCollectionController._destroyDelayMs);
  }

  public observeCollection(handler: CollectionObserver): Unsubscriber {
    this._collectionObservers.add(handler);
    if (this._items.size > 0) {
      this._notify();
    }
    return () => this.unobserveCollection(handler);
  }

  public unobserveCollection(handler: CollectionObserver): void {
    this._collectionObservers.delete(handler);
  }

  public observeProperties(handler: PropertyObserver): Unsubscriber {
    this._propertyObservers.add(handler);
    return () => this.unobserveProperties(handler);
  }

  public unobserveProperties(handler: PropertyObserver): void {
    this._propertyObservers.delete(handler);
  }

  public add(init: Partial<UploadEntryData>): Uid {
    const item = new TypedData<UploadEntryData>(initialUploadEntryData);
    for (const [prop, value] of Object.entries(init) as [
      keyof UploadEntryData,
      UploadEntryData[keyof UploadEntryData],
    ][]) {
      item.setValue(prop, value);
    }
    this._items.add(item.uid);
    this._notify();

    this._data.set(item.uid, item);
    this._added.add(item);
    for (const propName of UPLOAD_WATCH_LIST) {
      let subs = this._subsMap.get(item.uid);
      if (!subs) {
        subs = [];
        this._subsMap.set(item.uid, subs);
      }
      subs.push(item.subscribe(propName, () => this._notifyObservers(propName, item.uid)));
    }
    return item.uid;
  }

  public hasItem(id: Uid): boolean {
    return this._items.has(id);
  }

  public read(id: Uid): TypedData<UploadEntryData> | null {
    return this._data.get(id) ?? null;
  }

  public readProp<K extends keyof UploadEntryData>(id: Uid, propName: K): UploadEntryData[K] {
    const item = this.read(id);
    if (!item) {
      throw new Error(`UploadCollectionController#readProp: Item with id ${id} not found`);
    }
    return item.getValue(propName);
  }

  public publishProp<K extends keyof UploadEntryData>(id: Uid, propName: K, value: UploadEntryData[K]): void {
    const item = this.read(id);
    if (!item) {
      throw new Error(`UploadCollectionController#publishProp: Item with id ${id} not found`);
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
    this._data.delete(id);

    for (const sub of this._subsMap.get(id) ?? []) {
      sub();
    }
    this._subsMap.delete(id);
  }

  public abort(id: Uid): void {
    const item = this.read(id);
    if (item?.getValue('isUploading')) {
      this.remove(id);
    }
  }

  public abortAll(): void {
    for (const id of this._items) {
      this.abort(id);
    }
  }

  public clearAll(): void {
    for (const id of [...this._items]) {
      this.remove(id);
    }
  }

  public findItems(checkFn: (item: TypedData<UploadEntryData>) => boolean): Uid[] {
    const result: Uid[] = [];
    for (const id of this._items) {
      const item = this.read(id);
      if (item && checkFn(item)) {
        result.push(id);
      }
    }
    return result;
  }

  public items(): Uid[] {
    return [...this._items];
  }

  public get size(): number {
    return this._items.size;
  }

  public destroy(): void {
    if (this._observeTimeout) clearTimeout(this._observeTimeout);
    if (this._notifyTimeout) clearTimeout(this._notifyTimeout);
    if (this._destroyTimeout) clearTimeout(this._destroyTimeout);

    for (const item of this._markedToDestroy) {
      item.destroy();
    }
    this._markedToDestroy.clear();

    for (const item of this._data.values()) {
      item.destroy();
    }
    this._data.clear();

    this._propertyObservers.clear();
    this._collectionObservers.clear();
    for (const [, subs] of this._subsMap) {
      for (const sub of subs) sub();
    }
    this._subsMap.clear();
    this._items.clear();
    this._added.clear();
    this._removed.clear();
  }
}
