import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Uid } from '../lit/Uid';
import { TypedCollection } from './TypedCollection';
import { TypedData } from './TypedData';

describe('TypedCollection', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('supports basic add/read/publish/remove flows', () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const collection = new TypedCollection<{ name: string }>({
      initialValue: { name: '' },
      watchList: ['name'],
    });

    expect(collection.size).toBe(0);

    const id = collection.add({ name: 'a' });
    expect(collection.size).toBe(1);
    expect(collection.items()).toEqual([id]);

    expect(collection.read(id)).not.toBeNull();
    expect(collection.readProp(id, 'name')).toBe('a');

    collection.publishProp(id, 'name', 'b');
    expect(collection.readProp(id, 'name')).toBe('b');

    collection.remove(id);
    expect(collection.size).toBe(0);
    expect(collection.read(id)).toBeNull();
  });

  it('throws on readProp/publishProp for missing ids', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const collection = new TypedCollection<{ name: string }>({
      initialValue: { name: '' },
    });

    expect(() => collection.readProp('missing' as any, 'name')).toThrow(/not found/i);
    expect(() => collection.publishProp('missing' as any, 'name', 'x')).toThrow(/not found/i);
  });

  it('notifies collection observers with added/removed sets', () => {
    vi.useFakeTimers();

    const collection = new TypedCollection<{ name: string }>({
      initialValue: { name: '' },
    });

    const handler = vi.fn();
    collection.observeCollection(handler);

    const id = collection.add({ name: 'a' });
    vi.advanceTimersByTime(0);

    expect(handler).toHaveBeenCalledTimes(1);
    const [list1, added1, removed1] = handler.mock.calls[0] as [
      Uid[],
      Set<TypedData<{ name: string }>>,
      Set<TypedData<{ name: string }>>,
    ];
    expect(list1).toEqual([id]);
    expect(added1.size).toBe(1);
    expect(removed1.size).toBe(0);

    collection.remove(id);
    vi.advanceTimersByTime(0);

    expect(handler).toHaveBeenCalledTimes(2);
    const [list2, added2, removed2] = handler.mock.calls[1] as [
      Uid[],
      Set<TypedData<{ name: string }>>,
      Set<TypedData<{ name: string }>>,
    ];
    expect(list2).toEqual([]);
    expect(added2.size).toBe(0);
    expect(removed2.size).toBe(1);
  });

  it('notifies property observers for watched properties (batched)', () => {
    vi.useFakeTimers();

    const collection = new TypedCollection<{ name: string; other: number }>({
      initialValue: { name: '', other: 0 },
      watchList: ['name'],
    });

    const propHandler = vi.fn();
    collection.observeProperties(propHandler);

    const id = collection.add({ name: 'a', other: 1 });
    vi.advanceTimersByTime(0);

    // PubSub subscriptions may emit an initial value; we only care about changes below.
    propHandler.mockClear();

    collection.publishProp(id, 'name', 'b');
    collection.publishProp(id, 'name', 'c');

    expect(propHandler).not.toHaveBeenCalled();
    vi.advanceTimersByTime(0);

    expect(propHandler).toHaveBeenCalledTimes(1);
    const changeMap = propHandler.mock.calls[0]?.[0] as Record<string, Set<Uid>>;
    expect(changeMap.name?.has(id)).toBe(true);
  });

  it('removes per-item subscriptions on remove (no further property notifications)', () => {
    vi.useFakeTimers();

    const collection = new TypedCollection<{ name: string }>({
      initialValue: { name: '' },
      watchList: ['name'],
    });

    const propHandler = vi.fn();
    collection.observeProperties(propHandler);

    const id = collection.add({ name: 'a' });
    const item = collection.read(id);
    expect(item).not.toBeNull();

    // PubSub subscriptions may emit an initial value; ignore it for this test.
    vi.advanceTimersByTime(0);
    propHandler.mockClear();

    collection.remove(id);
    vi.advanceTimersByTime(0); // flush notify

    // The TypedData context is still alive until delayed cleanup, but collection must not listen anymore.
    (item as TypedData<{ name: string }>).setValue('name', 'z');
    vi.advanceTimersByTime(0);

    expect(propHandler).not.toHaveBeenCalled();
  });

  it('destroys removed item contexts after 10s from the last notify', () => {
    vi.useFakeTimers();

    const destroySpy = vi.spyOn(TypedData.prototype, 'destroy').mockImplementation(() => {});

    const collection = new TypedCollection<{ name: string }>({
      initialValue: { name: '' },
    });

    const id = collection.add({ name: 'a' });
    expect(collection.read(id)).not.toBeNull();

    collection.remove(id);

    // Flush notify (0ms). Still not destroyed.
    vi.advanceTimersByTime(0);
    expect(destroySpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(9_999);
    expect(destroySpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(destroySpy).toHaveBeenCalledTimes(1);
  });

  it('pushes destruction back when a new notify happens before 10s', () => {
    vi.useFakeTimers();

    const destroySpy = vi.spyOn(TypedData.prototype, 'destroy').mockImplementation(() => {});

    const collection = new TypedCollection<{ name: string }>({
      initialValue: { name: '' },
    });

    const id1 = collection.add({ name: 'a' });
    collection.remove(id1);
    vi.advanceTimersByTime(0); // notify at t=0, schedules destroy at t=10_000

    vi.advanceTimersByTime(5_000);

    const id2 = collection.add({ name: 'b' });
    collection.remove(id2);
    vi.advanceTimersByTime(0); // notify at t=5_000, reschedules destroy to t=15_000

    // At t=10_000 (old schedule) nothing should be destroyed yet.
    vi.advanceTimersByTime(5_000);
    expect(destroySpy).not.toHaveBeenCalled();

    // At t=15_000 both should be destroyed.
    vi.advanceTimersByTime(5_000);
    expect(destroySpy).toHaveBeenCalledTimes(2);
  });

  it('destroy() immediately cleans up marked items and clears pending timers', () => {
    vi.useFakeTimers();

    const destroySpy = vi.spyOn(TypedData.prototype, 'destroy').mockImplementation(() => {});

    const collection = new TypedCollection<{ name: string }>({
      initialValue: { name: '' },
    });

    const id = collection.add({ name: 'a' });
    collection.remove(id);
    vi.advanceTimersByTime(0); // flush notify and schedule delayed cleanup

    collection.destroy();
    expect(destroySpy).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(20_000);
    expect(destroySpy).toHaveBeenCalledTimes(1);
  });

  it('unobserveCollection stops further notifications', () => {
    vi.useFakeTimers();

    const collection = new TypedCollection<{ name: string }>({
      initialValue: { name: '' },
    });

    const handler = vi.fn();
    const unsubscribe = collection.observeCollection(handler);

    collection.add({ name: 'a' });
    vi.advanceTimersByTime(0);
    expect(handler).toHaveBeenCalledTimes(1);

    unsubscribe();

    collection.add({ name: 'b' });
    vi.advanceTimersByTime(0);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('findItems returns matching items', () => {
    const collection = new TypedCollection<{ name: string }>({
      initialValue: { name: '' },
    });

    const id1 = collection.add({ name: 'a' });
    const id2 = collection.add({ name: 'b' });

    const found = collection.findItems((item) => item.getValue('name') === 'b');
    expect(found).toEqual([id2]);
    expect(found).not.toContain(id1);
  });

  it('clearAll marks all items for delayed destroy', () => {
    vi.useFakeTimers();

    const destroySpy = vi.spyOn(TypedData.prototype, 'destroy').mockImplementation(() => {});

    const collection = new TypedCollection<{ name: string }>({
      initialValue: { name: '' },
    });

    collection.add({ name: 'a' });
    collection.add({ name: 'b' });
    vi.advanceTimersByTime(0);

    collection.clearAll();
    vi.advanceTimersByTime(0); // flush notify from clearAll

    vi.advanceTimersByTime(10_000);
    expect(destroySpy).toHaveBeenCalledTimes(2);
  });
});
