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

  it('read/readProp/publishProp work and watch-list changes notify property observers per-key', () => {
    const collection = new UploadCollectionController();
    const propObserver = vi.fn();
    collection.observeProperties(propObserver);

    const id = collection.add({ uploadProgress: 0 });
    vi.runOnlyPendingTimers(); // flush the add's immediate watch-list fires
    propObserver.mockClear();

    collection.publishProp(id, 'uploadProgress', 50);
    expect(collection.readProp(id, 'uploadProgress')).toBe(50);

    vi.runOnlyPendingTimers();
    expect(propObserver).toHaveBeenCalledTimes(1);
    const changeMap = (propObserver.mock.calls[0]?.[0] ?? {}) as Record<string, Set<string>>;
    expect([...(changeMap.uploadProgress ?? [])]).toContain(id);

    collection.destroy();
  });

  it('does not notify property observers for non-watch-list props', () => {
    const collection = new UploadCollectionController();
    const id = collection.add({});
    vi.runOnlyPendingTimers();

    const propObserver = vi.fn();
    collection.observeProperties(propObserver);
    collection.publishProp(id, 'thumbUrl', 'blob:x'); // thumbUrl is not in the watch-list
    vi.runOnlyPendingTimers();

    expect(propObserver).not.toHaveBeenCalled();
    collection.destroy();
  });

  it('remove() detaches immediately but keeps the entry alive until the ~10s deferred destroy', () => {
    const collection = new UploadCollectionController();
    const id = collection.add({});
    vi.runOnlyPendingTimers();

    collection.remove(id);
    expect(collection.hasItem(id)).toBe(false);
    expect(collection.read(id)).toBeNull(); // detached from the map immediately
    vi.runOnlyPendingTimers(); // fires _notify, which schedules the deferred destroy
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

    expect(collection.findItems((e) => (e.getValue('uploadProgress') as number) > 50)).toEqual([b]);

    collection.clearAll();
    expect(collection.size).toBe(0);

    vi.advanceTimersByTime(10_000);
    collection.destroy();
  });
});
