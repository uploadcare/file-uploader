import { describe, expect, it } from 'vitest';
import { ByteUnitEnum, prettyBytes } from './prettyBytes';

const EXPECTED_BASE = 1000;

describe('prettyBytes', () => {
  describe('auto unit mode', () => {
    it('should be enabled by default', () => {
      expect(prettyBytes(EXPECTED_BASE ** 3)).toBe('1 GB');
    });

    it('should print bytes if passed < 1 KB', () => {
      expect(prettyBytes(EXPECTED_BASE - 1)).toBe(`${EXPECTED_BASE - 1} bytes`);
    });

    it('should print KB if passed >= 1 KB and < 1 MB', () => {
      expect(prettyBytes(EXPECTED_BASE ** 1)).toBe('1 KB');
      expect(prettyBytes(EXPECTED_BASE ** 1 * (EXPECTED_BASE - 1))).toBe(`${EXPECTED_BASE - 1} KB`);
    });

    it('should print MB if passed >= 1 MB and < 1 GB', () => {
      expect(prettyBytes(EXPECTED_BASE ** 2)).toBe('1 MB');
      expect(prettyBytes(EXPECTED_BASE ** 2 * (EXPECTED_BASE - 1))).toBe(`${EXPECTED_BASE - 1} MB`);
    });

    it('should print GB if passed >= 1 GB and < 1 TB', () => {
      expect(prettyBytes(EXPECTED_BASE ** 3)).toBe('1 GB');
      expect(prettyBytes(EXPECTED_BASE ** 3 * (EXPECTED_BASE - 1))).toBe(`${EXPECTED_BASE - 1} GB`);
    });

    it('should print TB if passed > 1 TB and < 1 PB', () => {
      expect(prettyBytes(EXPECTED_BASE ** 4)).toBe('1 TB');
      expect(prettyBytes(EXPECTED_BASE ** 4 * (EXPECTED_BASE - 1))).toBe(`${EXPECTED_BASE - 1} TB`);
    });

    it('should print PB if passed > 1 PB', () => {
      expect(prettyBytes(EXPECTED_BASE ** 5)).toBe('1 PB');
      expect(prettyBytes(EXPECTED_BASE ** 5 * (EXPECTED_BASE - 1))).toBe(`${EXPECTED_BASE - 1} PB`);
      expect(prettyBytes(EXPECTED_BASE ** 5 * EXPECTED_BASE)).toBe(`${EXPECTED_BASE} PB`);
    });
  });

  describe('specified unit mode', () => {
    it('should print return bytes if specified bytes unit', () => {
      expect(prettyBytes(0, ByteUnitEnum.BYTE)).toBe('0 bytes');
      expect(prettyBytes(EXPECTED_BASE ** 1, ByteUnitEnum.BYTE)).toBe(`${EXPECTED_BASE ** 1} bytes`);
      expect(prettyBytes(EXPECTED_BASE ** 5, ByteUnitEnum.BYTE)).toBe(`${EXPECTED_BASE ** 5} bytes`);
    });

    it('should print KB if specified KB unit', () => {
      expect(prettyBytes(0, ByteUnitEnum.KB)).toBe('0 KB');

      expect(prettyBytes(EXPECTED_BASE ** 1 / 2, ByteUnitEnum.KB)).toBe('0.5 KB');
      expect(prettyBytes(EXPECTED_BASE ** 2, ByteUnitEnum.KB)).toBe(`${EXPECTED_BASE ** 1} KB`);
      expect(prettyBytes(EXPECTED_BASE ** 3, ByteUnitEnum.KB)).toBe(`${EXPECTED_BASE ** 2} KB`);
    });

    it('should print MB if specified MB unit', () => {
      expect(prettyBytes(0, ByteUnitEnum.MB)).toBe('0 MB');

      expect(prettyBytes(EXPECTED_BASE ** 2 / 2, ByteUnitEnum.MB)).toBe('0.5 MB');
      expect(prettyBytes(EXPECTED_BASE ** 3, ByteUnitEnum.MB)).toBe(`${EXPECTED_BASE ** 1} MB`);
      expect(prettyBytes(EXPECTED_BASE ** 4, ByteUnitEnum.MB)).toBe(`${EXPECTED_BASE ** 2} MB`);
    });

    it('should print GB if specified GB unit', () => {
      expect(prettyBytes(0, ByteUnitEnum.GB)).toBe('0 GB');

      expect(prettyBytes(EXPECTED_BASE ** 3 / 2, ByteUnitEnum.GB)).toBe('0.5 GB');
      expect(prettyBytes(EXPECTED_BASE ** 4, ByteUnitEnum.GB)).toBe(`${EXPECTED_BASE ** 1} GB`);
      expect(prettyBytes(EXPECTED_BASE ** 5, ByteUnitEnum.GB)).toBe(`${EXPECTED_BASE ** 2} GB`);
    });

    it('should print TB if specified TB unit', () => {
      expect(prettyBytes(0, ByteUnitEnum.TB)).toBe('0 TB');

      expect(prettyBytes(EXPECTED_BASE ** 4 / 2, ByteUnitEnum.TB)).toBe('0.5 TB');
      expect(prettyBytes(EXPECTED_BASE ** 5, ByteUnitEnum.TB)).toBe(`${EXPECTED_BASE ** 1} TB`);
      expect(prettyBytes(EXPECTED_BASE ** 6, ByteUnitEnum.TB)).toBe(`${EXPECTED_BASE ** 2} TB`);
    });

    it('should print PB if specified PB unit', () => {
      expect(prettyBytes(0, ByteUnitEnum.PB)).toBe('0 PB');

      expect(prettyBytes(EXPECTED_BASE ** 5 / 2, ByteUnitEnum.PB)).toBe('0.5 PB');
      expect(prettyBytes(EXPECTED_BASE ** 6, ByteUnitEnum.PB)).toBe(`${EXPECTED_BASE ** 1} PB`);
      expect(prettyBytes(EXPECTED_BASE ** 7, ByteUnitEnum.PB)).toBe(`${EXPECTED_BASE ** 2} PB`);
    });
  });

  describe('rounding', () => {
    it('should round up to 2 decimal places if necessary', () => {
      expect(prettyBytes(EXPECTED_BASE)).toBe('1 KB');
      expect(prettyBytes(EXPECTED_BASE * 1.5)).toBe('1.5 KB');
      expect(prettyBytes(EXPECTED_BASE * 1.55)).toBe('1.55 KB');
      expect(prettyBytes(EXPECTED_BASE * 1.555)).toBe('1.56 KB');
    });
  });
});
