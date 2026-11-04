import { afterEach, describe, expect, it } from 'vitest';
import { acquireScrollLock } from './scroll-lock';

describe('scroll-lock', () => {
  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('acquire hides body overflow; release restores the previous value', () => {
    document.body.style.overflow = 'scroll';

    const release = acquireScrollLock();
    expect(document.body.style.overflow).toBe('hidden');

    release();
    expect(document.body.style.overflow).toBe('scroll');
  });

  it('stays locked until every acquisition is released (modal-to-modal swap)', () => {
    const releaseA = acquireScrollLock(); // modal A opens
    const releaseB = acquireScrollLock(); // modal B opens (swap)
    releaseA(); // A hides after B is already up
    expect(document.body.style.overflow).toBe('hidden');

    releaseB();
    expect(document.body.style.overflow).toBe('');
  });

  it('release is idempotent — a double release cannot unlock another holder', () => {
    const releaseA = acquireScrollLock();
    const releaseB = acquireScrollLock(); // B holds
    releaseA();
    releaseA(); // stale double-release (e.g. hide + disconnect)
    expect(document.body.style.overflow).toBe('hidden');

    releaseB(); // the lock is module-wide: leave it free for the next case
  });

  it('re-locking after a full release captures the then-current overflow', () => {
    acquireScrollLock()();
    document.body.style.overflow = 'auto';
    const release = acquireScrollLock();
    expect(document.body.style.overflow).toBe('hidden');
    release();
    expect(document.body.style.overflow).toBe('auto');
  });
});
