import { describe, expect, it, vi } from 'vitest';
import { SignalMap } from './SignalMap';

type Shape = { a: number; b: string; nested: { x: number } };

describe('SignalMap', () => {
  it('starts empty when constructed with no initial values', () => {
    const map = new SignalMap<Shape>();
    expect(map.has('a')).toBe(false);
    expect(map.get('a')).toBeUndefined();
    expect(Object.keys(map.values)).toEqual([]);
  });

  it('seeds initial values without notifying', () => {
    const map = new SignalMap<Shape>({ a: 1, b: 'x' });
    const listener = vi.fn();
    map.subscribe(listener);

    expect(map.get('a')).toBe(1);
    expect(map.get('b')).toBe('x');
    expect(map.has('a')).toBe(true);
    // Seeding happened in the constructor, before the subscription — no notify.
    expect(listener).not.toHaveBeenCalled();
  });

  it('set() stores a new key and coarse-notifies', () => {
    const map = new SignalMap<Shape>();
    const listener = vi.fn();
    map.subscribe(listener);

    map.set('a', 1);
    expect(map.get('a')).toBe(1);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('set() updates an existing key and notifies on change', () => {
    const map = new SignalMap<Shape>({ a: 1 });
    const listener = vi.fn();
    map.subscribe(listener);

    map.set('a', 2);
    expect(map.get('a')).toBe(2);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('set() dedups unchanged writes with Object.is (both branches)', () => {
    const map = new SignalMap<Shape>({ a: 1 });
    const listener = vi.fn();
    map.subscribe(listener);

    map.set('a', 1); // seeded value unchanged → no notify
    expect(listener).not.toHaveBeenCalled();

    map.set('a', 2); // changed → notify
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('set(key, undefined) creates a present key (distinct from absent)', () => {
    const map = new SignalMap<{ a?: number }>();
    const listener = vi.fn();
    map.subscribe(listener);

    // Absent → present-`undefined` is a real change: the key must materialize
    // (otherwise a later default-seed could not tell it apart from never-set).
    map.set('a', undefined);
    expect(map.has('a')).toBe(true);
    expect(map.get('a')).toBeUndefined();
    expect(Object.hasOwn(map.values, 'a')).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);

    // A second identical write on the now-present key dedups via Object.is.
    map.set('a', undefined);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('signal() materializes a per-key signal seeded from the bag', () => {
    const map = new SignalMap<Shape>({ a: 1 });
    expect(map.signal('a').get()).toBe(1);
    // Same signal object returned on the second call (already materialized).
    expect(map.signal('a')).toBe(map.signal('a'));
  });

  it('signal() for an absent key starts undefined', () => {
    const map = new SignalMap<Shape>();
    expect(map.signal('a').get()).toBeUndefined();
  });

  it('set() keeps a materialized signal in sync with later writes', () => {
    const map = new SignalMap<Shape>({ a: 1 });
    const sig = map.signal('a');
    expect(sig.get()).toBe(1);
    // A later set must push into the live signal, not just the bag.
    map.set('a', 2);
    expect(sig.get()).toBe(2);
    expect(map.get('a')).toBe(2);
  });

  it('has() reports only present keys', () => {
    const map = new SignalMap<Shape>();
    expect(map.has('a')).toBe(false);
    map.set('a', 1);
    expect(map.has('a')).toBe(true);
  });

  it('get() does not create a phantom key (no leak into snapshot)', () => {
    const map = new SignalMap<Shape>();
    expect(map.get('a')).toBeUndefined();
    expect(map.has('a')).toBe(false);
    expect(Object.keys(map.values)).toEqual([]);
  });

  it('seed() adds an absent key without notifying', () => {
    const map = new SignalMap<Shape>();
    const listener = vi.fn();
    map.subscribe(listener);

    map.seed('a', 1);
    expect(map.get('a')).toBe(1);
    expect(map.has('a')).toBe(true);
    expect(listener).not.toHaveBeenCalled();
  });

  it('seed() does not overwrite a present key', () => {
    const map = new SignalMap<Shape>({ a: 1 });
    map.seed('a', 99);
    expect(map.get('a')).toBe(1);
  });

  it('seed() keeps an already-materialized signal in sync (without notifying)', () => {
    const map = new SignalMap<Shape>();
    const sig = map.signal('a');
    expect(sig.get()).toBeUndefined();

    const listener = vi.fn();
    map.subscribe(listener);

    map.seed('a', 1);
    expect(sig.get()).toBe(1);
    expect(map.get('a')).toBe(1);
    expect(listener).not.toHaveBeenCalled();
  });

  it('notify() fires subscribers without a state change', () => {
    const map = new SignalMap<Shape>();
    const listener = vi.fn();
    map.subscribe(listener);

    map.notify();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe stops notifications', () => {
    const map = new SignalMap<Shape>();
    const listener = vi.fn();
    const off = map.subscribe(listener);
    off();

    map.set('a', 1);
    expect(listener).not.toHaveBeenCalled();
  });

  it('values reflects the current value of every present key', () => {
    const map = new SignalMap<Shape>({ a: 1 });
    map.set('b', 'x');
    map.set('a', 2);

    const view = map.values;
    expect(view.a).toBe(2);
    expect(view.b).toBe('x');
    expect(Object.keys(view).sort()).toEqual(['a', 'b']);
  });

  it('values is a live, stable reference that reflects later writes', () => {
    const map = new SignalMap<Shape>({ a: 1 });
    const view = map.values;
    map.set('a', 2);
    expect(view.a).toBe(2); // same object, mutated in place
    expect(map.values).toBe(view); // stable identity across reads
    map.set('b', 'x');
    expect(view.b).toBe('x');
  });

  it('keys named __proto__ never pollute the prototype', () => {
    const map = new SignalMap<Record<string, unknown>>();
    map.set('__proto__', { polluted: true });

    expect(map.get('__proto__')).toEqual({ polluted: true });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.hasOwn(Object.prototype, 'polluted')).toBe(false);
    // Snapshot keeps it as an own property on a null-proto object.
    expect(Object.hasOwn(map.values, '__proto__')).toBe(true);
  });

  describe('observe (atomic per-key)', () => {
    it('fires only when the observed key changes, with the new value; not on subscribe', () => {
      const map = new SignalMap<Shape>({ a: 1, b: 'x' });
      const listener = vi.fn();
      map.observe('a', listener);
      expect(listener).not.toHaveBeenCalled(); // no eager fire

      map.set('b', 'y'); // unrelated key
      expect(listener).not.toHaveBeenCalled();

      map.set('a', 2);
      expect(listener).toHaveBeenCalledExactlyOnceWith(2);
    });

    it('dedups with Object.is (no fire when set to an equal value)', () => {
      const map = new SignalMap<Shape>({ a: 1 });
      const listener = vi.fn();
      map.observe('a', listener);
      map.set('a', 1);
      expect(listener).not.toHaveBeenCalled();
    });

    it('returns an unsubscriber that stops further notifications', () => {
      const map = new SignalMap<Shape>({ a: 1 });
      const listener = vi.fn();
      const unsub = map.observe('a', listener);
      map.set('a', 2);
      unsub();
      map.set('a', 3);
      expect(listener).toHaveBeenCalledExactlyOnceWith(2);
    });
  });

  it('destroy() clears values and listeners', () => {
    const map = new SignalMap<Shape>({ a: 1 });
    const listener = vi.fn();
    map.subscribe(listener);

    map.destroy();

    expect(map.has('a')).toBe(false);
    expect(Object.keys(map.values)).toEqual([]);
    map.set('a', 2);
    expect(listener).not.toHaveBeenCalled();
  });
});
