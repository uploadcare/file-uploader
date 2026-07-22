import type { Uid } from '../../lit/Uid';
import { debounce } from '../../utils/debounce';
import { TypedData } from '../TypedData';
import { initialUploadEntryData, type UploadEntryData } from '../uploadEntrySchema';

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
 * The v2 rewrite of v1's `TypedCollection`: same observation contract
 * (tick-debounced collection + property observers, a per-prop change-map, and a
 * ~10s deferred destroy of removed entries) backed by a plain `Map<uid,
 * TypedData>` and global timers, so it runs without a DOM.
 *
 * Observation is split into two channels:
 * - `observeCollection` — COARSE membership (list + added/removed), debounced to
 *   one tick per macrotask.
 * - `observeProperties(keys, handler)` — PER-PROP change-map, DEMAND-DRIVEN: a
 *   consumer declares the entry keys it cares about, and the controller gates
 *   the change-map to the live union of all observers' keys. This replaces the
 *   old hardcoded `UPLOAD_WATCH_LIST` — there is no global watch constant to
 *   drift, and firing is scoped to keys some consumer actually reads (so an
 *   internal-only mutation like `thumbUrl` can't spuriously drive downstream
 *   `change` events).
 *
 * Each entry is watched with a SINGLE `TypedData.subscribeKeys` subscription
 * (was one `observe` per watched key), so per-entry cost is `1×N` rather than
 * `8×N` at large file counts. The three timers are `utils/debounce` instances
 * (re-arm on call, `.cancel()` on teardown).
 */
export class UploadCollectionController {
  private static readonly _destroyDelayMs = 10_000;

  private _data = new Map<Uid, TypedData<UploadEntryData>>();
  // One key-change subscription per entry (was `UPLOAD_WATCH_LIST.length` per entry).
  private _entrySubs = new Map<Uid, Unsubscriber>();
  // Each property observer with the key-set it declared; `_observedKeys` is their
  // derived union — the gate for what enters the change-map.
  private _propertyObservers = new Map<PropertyObserver, ReadonlySet<keyof UploadEntryData>>();
  private _observedKeys = new Set<keyof UploadEntryData>();
  private _collectionObservers = new Set<CollectionObserver>();
  private _items = new Set<Uid>();
  private _removed = new Set<TypedData<UploadEntryData>>();
  private _added = new Set<TypedData<UploadEntryData>>();
  private _markedToDestroy = new Set<TypedData<UploadEntryData>>();
  private _changeMap: UploadCollectionChangeMap = Object.create(null);

  // The three batchers: property change-map + membership flush on the next tick,
  // deferred-destroy on the ~10s delay. Calling one (re-)arms it; `.cancel()`
  // tears it down. Deferred-destroy now lives solely here — no longer re-armed
  // from the two notify paths.
  private _scheduleProperties = debounce(() => this._flushProperties(), 0);
  private _scheduleMembership = debounce(() => this._flushMembership(), 0);
  private _scheduleDestroy = debounce(() => this._flushDestroy(), UploadCollectionController._destroyDelayMs);

  private _recomputeObservedKeys(): void {
    const keys = new Set<keyof UploadEntryData>();
    for (const declared of this._propertyObservers.values()) {
      for (const key of declared) {
        keys.add(key);
      }
    }
    this._observedKeys = keys;
  }

  // Queue a per-prop change into the change-map WITHOUT arming the flush; returns
  // whether it was queued (i.e. the key is observed). Split from `_recordPropChange`
  // so a batch (the immediate-on-add loop) can arm the debounce ONCE instead of
  // once per key — a bulk add of N files went from ~N×|observedKeys| debounce
  // re-arms down to N.
  private _queuePropChange(key: keyof UploadEntryData, uid: Uid): boolean {
    // Gate to the live union of observed keys — an unobserved key never enters
    // the change-map, so it can't drive a downstream tick.
    if (!this._observedKeys.has(key)) {
      return false;
    }
    let set = this._changeMap[key];
    if (!set) {
      set = new Set();
      this._changeMap[key] = set;
    }
    set.add(uid);
    return true;
  }

  private _recordPropChange(key: keyof UploadEntryData, uid: Uid): void {
    if (this._queuePropChange(key, uid)) {
      this._scheduleProperties();
    }
  }

  private _flushProperties(): void {
    const changeMap = this._changeMap;
    this._changeMap = Object.create(null);
    const changedKeys = Object.keys(changeMap) as (keyof UploadEntryData)[];
    for (const [handler, declared] of this._propertyObservers) {
      // Deliver each observer ONLY its declared keys, and skip it entirely when
      // none of them changed. This is what makes the demand-driven declaration
      // actually scope work: a consumer that didn't declare `uploadProgress`
      // (UploadList/DynamicBtn/ProgressBarCommon) is not woken by a progress
      // tick, even though another observer (UploadEventsController) did declare
      // it and put it in the change-map.
      const scoped: UploadCollectionChangeMap = Object.create(null);
      let any = false;
      for (const key of changedKeys) {
        if (declared.has(key)) {
          scoped[key] = changeMap[key];
          any = true;
        }
      }
      if (any) {
        handler(scoped);
      }
    }
  }

  private _flushMembership(): void {
    const added = new Set(this._added);
    const removed = new Set(this._removed);
    this._added.clear();
    this._removed.clear();
    const list = [...this._items];
    for (const handler of this._collectionObservers) {
      handler(list, added, removed);
    }
  }

  private _flushDestroy(): void {
    const marked = [...this._markedToDestroy];
    this._markedToDestroy.clear();
    for (const item of marked) {
      item.destroy();
    }
  }

  public observeCollection(handler: CollectionObserver): Unsubscriber {
    this._collectionObservers.add(handler);
    if (this._items.size > 0) {
      this._scheduleMembership();
    }
    return () => this.unobserveCollection(handler);
  }

  public unobserveCollection(handler: CollectionObserver): void {
    this._collectionObservers.delete(handler);
  }

  /**
   * Observe per-entry property changes for the declared `keys`. `handler` gets a
   * change-map (`{ key: Set<uid> }`) on the next tick after any observed key
   * changes; it filters to the keys it reads. Declaring the keys is what lets the
   * controller drop the hardcoded watch-list — only declared keys are tracked.
   */
  public observeProperties(keys: readonly (keyof UploadEntryData)[], handler: PropertyObserver): Unsubscriber {
    this._propertyObservers.set(handler, new Set(keys));
    this._recomputeObservedKeys();
    return () => this.unobserveProperties(handler);
  }

  public unobserveProperties(handler: PropertyObserver): void {
    this._propertyObservers.delete(handler);
    this._recomputeObservedKeys();
  }

  // Insert one entry's state + key-subscription WITHOUT arming any flush. Shared
  // by `add`/`addMany` so a batch arms the two 0-delay timers ONCE for the whole
  // batch instead of once per entry.
  private _insertEntry(init: Partial<UploadEntryData>): TypedData<UploadEntryData> {
    const item = new TypedData<UploadEntryData>(initialUploadEntryData);
    item.setMany(init);
    // Populate state BEFORE the membership tick is armed (the flush reads
    // `_added`/`_items`), and subscribe AFTER seeding so the init write doesn't
    // pollute the change-map (add is a membership event, not a property change).
    this._data.set(item.uid, item);
    this._items.add(item.uid);
    this._added.add(item);
    this._entrySubs.set(
      item.uid,
      item.subscribeKeys((key) => this._recordPropChange(key, item.uid)),
    );
    return item;
  }

  // Immediate-on-add (v1 parity): surface the new entry's initial observed-key
  // state to property observers (the old per-key `observe(..., {immediate:true})`).
  // Load-bearing for an already-uploaded entry (fileInfo set at add ⇒ fires
  // FILE_UPLOAD_SUCCESS / drives the success collection state without an upload).
  // Queues WITHOUT scheduling; the caller arms the flush once. Returns whether
  // anything was queued.
  private _queueImmediateOnAdd(item: TypedData<UploadEntryData>): boolean {
    let queued = false;
    for (const key of this._observedKeys) {
      queued = this._queuePropChange(key, item.uid) || queued;
    }
    return queued;
  }

  public add(init: Partial<UploadEntryData>): Uid {
    const item = this._insertEntry(init);
    // Arm membership BEFORE the immediate-on-add property fire so their 0-delay
    // ticks flush in that order (v1 parity): a consumer sees `FILE_ADDED` before
    // any per-prop event for the new entry — notably `FILE_UPLOAD_SUCCESS`.
    this._scheduleMembership();
    if (this._queueImmediateOnAdd(item)) {
      this._scheduleProperties();
    }
    return item.uid;
  }

  /**
   * Batch-add: insert all entries, then arm the membership + property flushes ONCE
   * (a per-`add` loop re-arms both 0-delay timers per file — N re-arms — and, at the
   * public-API layer, builds a discarded `OutputFileEntry` per file). Same flush
   * order/outcome as `add` (membership tick before the property tick).
   */
  public addMany(inits: Partial<UploadEntryData>[]): Uid[] {
    if (inits.length === 0) {
      return [];
    }
    const items = inits.map((init) => this._insertEntry(init));
    this._scheduleMembership();
    let queued = false;
    for (const item of items) {
      queued = this._queueImmediateOnAdd(item) || queued;
    }
    if (queued) {
      this._scheduleProperties();
    }
    return items.map((item) => item.uid);
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
    return item.get(propName);
  }

  public publishProp<K extends keyof UploadEntryData>(id: Uid, propName: K, value: UploadEntryData[K]): void {
    const item = this.read(id);
    if (!item) {
      throw new Error(`UploadCollectionController#publishProp: Item with id ${id} not found`);
    }
    item.set(propName, value);
  }

  public remove(id: Uid): void {
    const item = this.read(id);
    if (item) {
      // Removing an entry aborts its in-flight upload — this file/upload
      // side-effect lives here at the collection level, not in the UI. A no-op
      // when there is no controller or the request already settled.
      item.get('abortController')?.abort();
      this._removed.add(item);
      this._markedToDestroy.add(item);
    }
    this._items.delete(id);
    this._data.delete(id);

    this._entrySubs.get(id)?.();
    this._entrySubs.delete(id);

    // Drop any property change queued for this entry before the next flush: a
    // property tick must not notify observers about a uid that `read()` no
    // longer resolves (and, with membership armed just below, must not deliver a
    // stale property change ahead of the removal). The removal itself is carried
    // by the membership `removed` set.
    for (const key of Object.keys(this._changeMap) as (keyof UploadEntryData)[]) {
      const set = this._changeMap[key];
      if (set?.delete(id) && set.size === 0) {
        delete this._changeMap[key];
      }
    }

    this._scheduleMembership();
    // Deferred-destroy is armed here, once, when something is actually marked —
    // not re-armed from the notify paths.
    if (item) {
      this._scheduleDestroy();
    }
  }

  public abort(id: Uid): void {
    const item = this.read(id);
    if (item?.get('isUploading')) {
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
    this._scheduleProperties.cancel();
    this._scheduleMembership.cancel();
    this._scheduleDestroy.cancel();

    // Force-destroy entries still in the deferred-destroy window, then the live
    // entries.
    for (const item of this._markedToDestroy) {
      item.destroy();
    }
    this._markedToDestroy.clear();

    for (const item of this._data.values()) {
      item.destroy();
    }
    this._data.clear();

    this._propertyObservers.clear();
    this._observedKeys.clear();
    this._collectionObservers.clear();
    for (const off of this._entrySubs.values()) {
      off();
    }
    this._entrySubs.clear();
    this._items.clear();
    this._added.clear();
    this._removed.clear();
    this._changeMap = Object.create(null);
  }
}
