import { describe, expect, it, vi } from 'vitest';
import type { Uid } from '../../lit/Uid';
import type { OutputCollectionState, OutputErrorCollection } from '../../types';
import { CollectionStateController } from './CollectionStateController';

const uid = (s: string) => s as Uid;

describe('CollectionStateController', () => {
  it('seeds the derived keys with their v1 initial values', () => {
    const c = new CollectionStateController();
    expect(c.get('uploadList')).toEqual([]);
    expect(c.get('commonProgress')).toBe(0);
    expect(c.get('collectionState')).toBeNull();
    expect(c.get('collectionErrors')).toEqual([]);
    expect(c.get('groupInfo')).toBeNull();
  });

  it('round-trips a write through get/set', () => {
    const c = new CollectionStateController();
    c.set('commonProgress', 42);
    expect(c.get('commonProgress')).toBe(42);

    const list = [{ uid: uid('a') }];
    c.set('uploadList', list);
    expect(c.get('uploadList')).toBe(list);
  });

  it('builds fresh mutable seeds per instance (no cross-ctx sharing)', () => {
    const a = new CollectionStateController();
    const b = new CollectionStateController();
    expect(a.get('uploadList')).not.toBe(b.get('uploadList'));
    expect(a.get('collectionErrors')).not.toBe(b.get('collectionErrors'));
  });

  it('subscribe fires (coarse) on a real change and dedups an equal write (Object.is)', () => {
    const c = new CollectionStateController();
    const cb = vi.fn();
    c.subscribe(cb);

    c.set('commonProgress', 10);
    expect(cb).toHaveBeenCalledTimes(1);

    c.set('commonProgress', 10); // Object.is dedup — no fire
    expect(cb).toHaveBeenCalledTimes(1);

    c.set('commonProgress', 20);
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('reference-typed keys dedup by reference: replacing fires, mutating in place does not', () => {
    const c = new CollectionStateController();
    const cb = vi.fn();
    c.subscribe(cb);

    const list1 = [{ uid: uid('a') }];
    c.set('uploadList', list1);
    expect(cb).toHaveBeenCalledTimes(1);

    // Mutating the stored array in place does not route through set() → no notify
    // (v1 nanostores parity).
    c.get('uploadList').push({ uid: uid('b') });
    expect(cb).toHaveBeenCalledTimes(1);

    // Setting the SAME reference again is a no-op (Object.is).
    c.set('uploadList', list1);
    expect(cb).toHaveBeenCalledTimes(1);

    // A new reference fires.
    c.set('uploadList', []);
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('subscribe returns an unsubscribe that stops further notifications', () => {
    const c = new CollectionStateController();
    const cb = vi.fn();
    const unsub = c.subscribe(cb);
    c.set('commonProgress', 1);
    expect(cb).toHaveBeenCalledTimes(1);
    unsub();
    c.set('commonProgress', 2);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('carries typed collection payloads round-trip', () => {
    const c = new CollectionStateController();
    const state = { totalCount: 1 } as unknown as OutputCollectionState;
    const errors = [{ type: 'x' }] as unknown as OutputErrorCollection[];
    c.set('collectionState', state);
    c.set('collectionErrors', errors);
    expect(c.get('collectionState')).toBe(state);
    expect(c.get('collectionErrors')).toBe(errors);
  });

  it('destroy() clears the store', () => {
    const c = new CollectionStateController();
    const cb = vi.fn();
    c.subscribe(cb);
    c.destroy();
    // Listeners cleared — a post-destroy write must not notify the old subscriber.
    c.set('commonProgress', 99);
    expect(cb).not.toHaveBeenCalled();
  });

  it('setMany coalesces multiple genuinely-changed keys into one notify', () => {
    const c = new CollectionStateController();
    const listener = vi.fn();
    c.subscribe(listener);
    // Two keys that ACTUALLY change: commonProgress (0 -> 50) and a fresh
    // collectionErrors array reference (Object.is-distinct from the seeded []).
    // Without coalescing this would notify twice; with it, exactly once.
    c.setMany({ commonProgress: 50, collectionErrors: [] });
    expect(c.get('commonProgress')).toBe(50);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
