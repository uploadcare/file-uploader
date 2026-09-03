import { describe, expect, it } from 'vitest';
import { createScrollLock, getScrollLock } from './scroll-lock';

const fakeDoc = (overflow = '') => ({ body: { style: { overflow } } }) as unknown as Document;

describe('scroll-lock', () => {
  it('acquire hides body overflow; release restores the previous value', () => {
    const doc = fakeDoc('scroll');
    const lock = createScrollLock(doc);

    const release = lock.acquire();
    expect(doc.body.style.overflow).toBe('hidden');

    release();
    expect(doc.body.style.overflow).toBe('scroll');
  });

  it('stays locked until every acquisition is released (modal-to-modal swap)', () => {
    const doc = fakeDoc();
    const lock = createScrollLock(doc);

    const releaseA = lock.acquire(); // modal A opens
    const releaseB = lock.acquire(); // modal B opens (swap)
    releaseA(); // A hides after B is already up
    expect(doc.body.style.overflow).toBe('hidden');

    releaseB();
    expect(doc.body.style.overflow).toBe('');
  });

  it('release is idempotent — a double release cannot unlock another holder', () => {
    const doc = fakeDoc();
    const lock = createScrollLock(doc);

    const releaseA = lock.acquire();
    lock.acquire(); // B holds
    releaseA();
    releaseA(); // stale double-release (e.g. hide + disconnect)
    expect(doc.body.style.overflow).toBe('hidden');
  });

  it('re-locking after a full release captures the then-current overflow', () => {
    const doc = fakeDoc();
    const lock = createScrollLock(doc);

    lock.acquire()();
    doc.body.style.overflow = 'auto';
    const release = lock.acquire();
    expect(doc.body.style.overflow).toBe('hidden');
    release();
    expect(doc.body.style.overflow).toBe('auto');
  });

  it('getScrollLock returns one shared lock per document', () => {
    const doc = fakeDoc();
    expect(getScrollLock(doc)).toBe(getScrollLock(doc));
    expect(getScrollLock(doc)).not.toBe(getScrollLock(fakeDoc()));
  });
});
