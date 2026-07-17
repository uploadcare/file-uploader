import { describe, expect, it, vi } from 'vitest';
import type { Uid } from '../../lit/Uid';
import type { OutputCollectionState, OutputErrorCollection } from '../../types';
import { CollectionStateController } from './CollectionStateController';

const uid = (s: string) => s as Uid;

describe('CollectionStateController', () => {
  it('seeds the six derived keys with their v1 initial values', () => {
    const c = new CollectionStateController();
    expect(c.get('uploadList')).toEqual([]);
    expect(c.get('commonProgress')).toBe(0);
    expect(c.get('collectionState')).toBeNull();
    expect(c.get('collectionErrors')).toEqual([]);
    expect(c.get('groupInfo')).toBeNull();
    expect(c.get('uploadTrigger')).toBeInstanceOf(Set);
    expect(c.get('uploadTrigger').size).toBe(0);
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
    expect(a.get('uploadTrigger')).not.toBe(b.get('uploadTrigger'));
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

  it('uploadTrigger dedup is by reference: replacing fires, mutating in place does not', () => {
    const c = new CollectionStateController();
    const cb = vi.fn();
    c.subscribe(cb);

    const set1 = new Set<Uid>([uid('a')]);
    c.set('uploadTrigger', set1);
    expect(cb).toHaveBeenCalledTimes(1);

    // Mutating the stored set in place does not route through set() → no notify
    // (v1 nanostores parity — UploadEventsController mutates the live set).
    c.get('uploadTrigger').delete(uid('a'));
    expect(cb).toHaveBeenCalledTimes(1);
    expect(c.get('uploadTrigger').size).toBe(0);

    // Setting the SAME reference again is a no-op (Object.is).
    c.set('uploadTrigger', set1);
    expect(cb).toHaveBeenCalledTimes(1);

    // A new reference fires.
    c.set('uploadTrigger', new Set<Uid>());
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
});
