import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TypedData } from '../TypedData';
import { UploadCollectionController } from './UploadCollectionController';

describe('UploadCollectionController', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('add() inserts an entry and notifies collection observers (debounced) with the added set', () => {
    const collection = new UploadCollectionController();
    const observer = vi.fn();
    collection.observeCollection(observer);

    const id = collection.add({ uploadProgress: 0 });
    expect(collection.size).toBe(1);
    expect(collection.items()).toEqual([id]);
    expect(collection.hasItem(id)).toBe(true);
    expect(observer).not.toHaveBeenCalled(); // debounced

    vi.runOnlyPendingTimers();
    expect(observer).toHaveBeenCalled();
    const [list, added, removed] = observer.mock.calls.at(-1) as [string[], Set<{ uid: string }>, Set<{ uid: string }>];
    expect(list).toEqual([id]);
    expect([...added].map((e) => e.uid)).toContain(id);
    expect(removed.size).toBe(0);

    collection.destroy();
  });

  it('read/readProp/publishProp work and an observed key change notifies property observers per-key', () => {
    const collection = new UploadCollectionController();
    const propObserver = vi.fn();
    collection.observeProperties(['uploadProgress'], propObserver);

    const id = collection.add({ uploadProgress: 0 });
    vi.runOnlyPendingTimers(); // flush the immediate-on-add fire for observed keys
    propObserver.mockClear();

    collection.publishProp(id, 'uploadProgress', 50);
    expect(collection.readProp(id, 'uploadProgress')).toBe(50);

    vi.runOnlyPendingTimers();
    expect(propObserver).toHaveBeenCalledTimes(1);
    const changeMap = (propObserver.mock.calls[0]?.[0] ?? {}) as Record<string, Set<string>>;
    expect([...(changeMap.uploadProgress ?? [])]).toContain(id);

    collection.destroy();
  });

  it('immediate-on-add: surfaces the initial observed-key state of a new entry', () => {
    // Load-bearing for already-uploaded files: an entry added with `fileInfo`
    // set must reach the fileInfo-observing consumer on add (→ FILE_UPLOAD_SUCCESS),
    // with no property change afterward.
    const collection = new UploadCollectionController();
    const propObserver = vi.fn();
    collection.observeProperties(['fileInfo'], propObserver); // observe BEFORE add

    const id = collection.add({ fileInfo: { uuid: 'srv' } as never });
    vi.runOnlyPendingTimers();

    const changeMap = (propObserver.mock.calls[0]?.[0] ?? {}) as Record<string, Set<string>>;
    expect([...(changeMap.fileInfo ?? [])]).toContain(id);
    collection.destroy();
  });

  it('scopes fan-out per observer: an observer is not woken by another observer’s key', () => {
    const collection = new UploadCollectionController();
    const id = collection.add({});
    vi.runOnlyPendingTimers();

    const progressObs = vi.fn();
    const uploadingObs = vi.fn();
    collection.observeProperties(['uploadProgress'], progressObs);
    collection.observeProperties(['isUploading'], uploadingObs);

    collection.publishProp(id, 'uploadProgress', 50); // only uploadProgress changes
    vi.runOnlyPendingTimers();

    expect(progressObs).toHaveBeenCalledTimes(1);
    expect(uploadingObs).not.toHaveBeenCalled(); // not woken — it declared only isUploading
    // …and each observer sees only its own key.
    expect(Object.keys((progressObs.mock.calls[0]?.[0] ?? {}) as object)).toEqual(['uploadProgress']);
    collection.destroy();
  });

  it('add fires the collection (membership) observer before the property observer', () => {
    const collection = new UploadCollectionController();
    const order: string[] = [];
    collection.observeCollection(() => order.push('collection'));
    collection.observeProperties(['fileInfo'], () => order.push('property'));

    // An already-uploaded entry (fileInfo set) fires both on add; membership first.
    collection.add({ fileInfo: { uuid: 'srv' } as never });
    vi.runOnlyPendingTimers();

    expect(order).toEqual(['collection', 'property']);
    collection.destroy();
  });

  it('drops a queued property change for an entry removed before the flush', () => {
    const collection = new UploadCollectionController();
    const propObserver = vi.fn();
    collection.observeProperties(['uploadProgress'], propObserver);
    const id = collection.add({});
    vi.runOnlyPendingTimers();
    propObserver.mockClear();

    // Queue a property change, then remove the entry in the same macrotask —
    // the pending flush must not report the now-unresolvable uid.
    collection.publishProp(id, 'uploadProgress', 50);
    collection.remove(id);
    vi.runOnlyPendingTimers();

    for (const call of propObserver.mock.calls) {
      const changeMap = call[0] as Record<string, Set<string>>;
      expect(changeMap.uploadProgress?.has(id) ?? false).toBe(false);
    }
    collection.destroy();
  });

  it('does not notify property observers for an unobserved key', () => {
    const collection = new UploadCollectionController();
    const id = collection.add({});
    vi.runOnlyPendingTimers();

    const propObserver = vi.fn();
    collection.observeProperties(['uploadProgress'], propObserver); // only uploadProgress observed
    collection.publishProp(id, 'thumbUrl', 'blob:x'); // thumbUrl is not observed
    vi.runOnlyPendingTimers();

    expect(propObserver).not.toHaveBeenCalled();
    collection.destroy();
  });

  it('gates the change-map to declared keys even when other keys change in the same tick', () => {
    const collection = new UploadCollectionController();
    const id = collection.add({});
    vi.runOnlyPendingTimers();

    const propObserver = vi.fn();
    collection.observeProperties(['isUploading'], propObserver);
    // Two keys change in one macrotask; only the declared one may enter the map.
    collection.publishProp(id, 'thumbUrl', 'blob:x');
    collection.publishProp(id, 'isUploading', true);
    vi.runOnlyPendingTimers();

    expect(propObserver).toHaveBeenCalledTimes(1);
    const changeMap = (propObserver.mock.calls[0]?.[0] ?? {}) as Record<string, Set<string>>;
    expect(Object.keys(changeMap)).toEqual(['isUploading']);
    collection.destroy();
  });

  it('an observed cdnUrlModifiers change reaches the change-map (the former watch-list gap)', () => {
    const collection = new UploadCollectionController();
    const id = collection.add({});
    vi.runOnlyPendingTimers();

    const propObserver = vi.fn();
    collection.observeProperties(['cdnUrlModifiers'], propObserver);
    collection.publishProp(id, 'cdnUrlModifiers', '-/preview/');
    vi.runOnlyPendingTimers();

    const changeMap = (propObserver.mock.calls[0]?.[0] ?? {}) as Record<string, Set<string>>;
    expect([...(changeMap.cdnUrlModifiers ?? [])]).toContain(id);
    collection.destroy();
  });

  it('remove() detaches immediately but keeps the entry alive until the ~10s deferred destroy', () => {
    const collection = new UploadCollectionController();
    const id = collection.add({});
    vi.runOnlyPendingTimers();

    collection.remove(id);
    expect(collection.hasItem(id)).toBe(false);
    expect(collection.read(id)).toBeNull(); // detached from the map immediately
    vi.advanceTimersByTime(1); // flush the 0-delay membership tick, not the 10s destroy
    expect(TypedData.getByUid(id)).not.toBeNull(); // entry data still readable in the window

    vi.advanceTimersByTime(10_000);
    expect(TypedData.getByUid(id)).toBeNull(); // destroyed after the window

    collection.destroy();
  });

  it('observeCollection on a non-empty collection notifies immediately (debounced)', () => {
    const collection = new UploadCollectionController();
    collection.add({});
    vi.runOnlyPendingTimers();

    const observer = vi.fn();
    collection.observeCollection(observer);
    vi.runOnlyPendingTimers();
    expect(observer).toHaveBeenCalled();

    collection.destroy();
  });

  it('findItems filters and clearAll empties the collection', () => {
    const collection = new UploadCollectionController();
    collection.add({ uploadProgress: 10 });
    const b = collection.add({ uploadProgress: 90 });
    vi.runOnlyPendingTimers();

    expect(collection.findItems((e) => (e.get('uploadProgress') as number) > 50)).toEqual([b]);

    collection.clearAll();
    expect(collection.size).toBe(0);

    vi.advanceTimersByTime(10_000);
    collection.destroy();
  });

  it('readProp / publishProp throw for an unknown id', () => {
    const collection = new UploadCollectionController();
    expect(() => collection.readProp('ghost' as never, 'uploadProgress')).toThrow(/not found/);
    expect(() => collection.publishProp('ghost' as never, 'uploadProgress', 1)).toThrow(/not found/);
    collection.destroy();
  });

  it('abort removes an uploading entry and leaves a non-uploading one', () => {
    const collection = new UploadCollectionController();
    const uploading = collection.add({ isUploading: true });
    const idle = collection.add({ isUploading: false });
    vi.runOnlyPendingTimers();

    collection.abort(uploading);
    collection.abort(idle);

    expect(collection.hasItem(uploading)).toBe(false); // uploading → removed
    expect(collection.hasItem(idle)).toBe(true); // not uploading → untouched

    vi.advanceTimersByTime(10_000);
    collection.destroy();
  });

  it('addMany inserts all entries with a single membership flush + one immediate-on-add property flush', () => {
    const collection = new UploadCollectionController();
    const collObserver = vi.fn();
    const propObserver = vi.fn();
    collection.observeCollection(collObserver);
    collection.observeProperties(['fileInfo'], propObserver);

    const uids = collection.addMany([{ fileName: 'a' }, { fileName: 'b' }, { fileInfo: { uuid: 'x' } as never }]);
    expect(uids).toHaveLength(3);
    expect(collection.size).toBe(3);

    vi.runOnlyPendingTimers();
    // ONE membership flush carrying all three additions.
    expect(collObserver).toHaveBeenCalledTimes(1);
    const added = collObserver.mock.calls[0]?.[1] as Set<unknown>;
    expect(added.size).toBe(3);
    // Immediate-on-add fires the property observer ONCE for the batch (not per entry).
    expect(propObserver).toHaveBeenCalledTimes(1);
    const change = propObserver.mock.calls[0]?.[0] as { fileInfo?: Set<unknown> };
    expect(change.fileInfo?.size).toBe(3);

    vi.advanceTimersByTime(10_000);
    collection.destroy();
  });

  it('addMany([]) is a no-op returning []', () => {
    const collection = new UploadCollectionController();
    const collObserver = vi.fn();
    collection.observeCollection(collObserver);
    expect(collection.addMany([])).toEqual([]);
    vi.runOnlyPendingTimers();
    expect(collObserver).not.toHaveBeenCalled();
    collection.destroy();
  });

  it('remove() aborts the entry in-flight upload (abortController)', () => {
    const collection = new UploadCollectionController();
    const abort = vi.fn();
    const id = collection.add({ abortController: { abort, signal: {} } as unknown as AbortController });
    vi.runOnlyPendingTimers();

    collection.remove(id);
    expect(abort).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(10_000);
    collection.destroy();
  });

  it('abortAll aborts only the uploading entries', () => {
    const collection = new UploadCollectionController();
    const uploading = collection.add({ isUploading: true });
    const idle = collection.add({ isUploading: false });
    vi.runOnlyPendingTimers();

    collection.abortAll();

    expect(collection.hasItem(uploading)).toBe(false);
    expect(collection.hasItem(idle)).toBe(true);

    vi.advanceTimersByTime(10_000);
    collection.destroy();
  });

  it('unobserve stops further collection + property notifications', () => {
    const collection = new UploadCollectionController();
    const collObserver = vi.fn();
    const propObserver = vi.fn();
    const offColl = collection.observeCollection(collObserver);
    const offProp = collection.observeProperties(['uploadProgress'], propObserver);

    const id = collection.add({ uploadProgress: 0 });
    vi.runOnlyPendingTimers();
    collObserver.mockClear();
    propObserver.mockClear();

    offColl();
    offProp();

    collection.add({});
    collection.publishProp(id, 'uploadProgress', 42);
    vi.runOnlyPendingTimers();

    expect(collObserver).not.toHaveBeenCalled();
    expect(propObserver).not.toHaveBeenCalled();
    collection.destroy();
  });

  it('re-arms the deferred-destroy timer when another entry is removed mid-window', () => {
    const collection = new UploadCollectionController();
    const a = collection.add({});
    const b = collection.add({});
    vi.advanceTimersByTime(1); // flush adds (0-delay notify), not the 10s destroy

    collection.remove(a);
    vi.advanceTimersByTime(1); // _notify flush schedules the deferred-destroy timer
    vi.advanceTimersByTime(5_000); // partway through the 10s window
    collection.remove(b);
    vi.advanceTimersByTime(1); // _notify flush re-arms the destroy timer (clears the pending one)
    expect(TypedData.getByUid(a)).not.toBeNull(); // still alive — the re-arm reset the window

    vi.advanceTimersByTime(10_000); // full window from the re-arm
    expect(TypedData.getByUid(a)).toBeNull();
    expect(TypedData.getByUid(b)).toBeNull();
    collection.destroy();
  });

  it('destroy() force-destroys entries still marked for deferred destroy', () => {
    const collection = new UploadCollectionController();
    const id = collection.add({});
    vi.runOnlyPendingTimers();

    collection.remove(id); // marks for the ~10s deferred destroy
    vi.advanceTimersByTime(1); // flush membership only; the 10s destroy stays pending
    expect(TypedData.getByUid(id)).not.toBeNull(); // still in the destroy window

    collection.destroy(); // must force-destroy the marked entry now, not wait 10s
    expect(TypedData.getByUid(id)).toBeNull();
  });
});
