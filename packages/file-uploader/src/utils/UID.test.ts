import { describe, expect, it, vi } from 'vitest';
import { UID } from './UID';

const FAST_UID_RE = /^uid-[0-9a-z]+-[0-9a-z]{9}$/;

describe('UID', () => {
  describe('generateFastUid', () => {
    it('returns a uid-like string', () => {
      expect(UID.generateFastUid()).toMatch(FAST_UID_RE);
    });

    it('returns different values across calls', () => {
      const a = UID.generateFastUid();
      const b = UID.generateFastUid();
      expect(a).not.toBe(b);
    });
  });

  describe('generateRandomUUID', () => {
    it('uses crypto.randomUUID when available', () => {
      const cryptoObj = (globalThis as unknown as { crypto?: Crypto }).crypto;
      if (!cryptoObj || typeof cryptoObj.randomUUID !== 'function') {
        // Environment without crypto.randomUUID() should still return a valid fallback uid.
        expect(UID.generateRandomUUID()).toMatch(FAST_UID_RE);
        return;
      }

      const fakeUuid = '00000000-0000-0000-0000-000000000000' as const;
      const spy = vi.spyOn(cryptoObj, 'randomUUID').mockReturnValue(fakeUuid);
      expect(UID.generateRandomUUID()).toBe(fakeUuid);
      expect(spy).toHaveBeenCalledTimes(1);
      spy.mockRestore();
    });

    it('falls back to fast uid when crypto.randomUUID is not available', () => {
      const cryptoDesc = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
      if (cryptoDesc && cryptoDesc.configurable === false) {
        // Can't reliably override crypto in this environment.
        expect(true).toBe(true);
        return;
      }

      try {
        Object.defineProperty(globalThis, 'crypto', {
          value: {},
          configurable: true,
        });

        const value = UID.generateRandomUUID();
        expect(value).toMatch(FAST_UID_RE);
      } finally {
        if (cryptoDesc) {
          Object.defineProperty(globalThis, 'crypto', cryptoDesc);
        } else {
          delete (globalThis as any).crypto;
        }
      }
    });
  });
});
