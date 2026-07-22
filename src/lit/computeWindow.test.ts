import { describe, expect, it } from 'vitest';
import { computeWindow, type WindowMetrics } from './computeWindow';

// (relocated to src/lit/ — shared virtualization primitive used by VirtualListController)

const base: WindowMetrics = {
  total: 0,
  scrollTop: 0,
  viewportHeight: 0,
  rowHeight: 0,
  columns: 1,
  overscanRows: 0,
};

describe('computeWindow', () => {
  describe('unmeasurable / empty → render-all fallback (no spacers)', () => {
    it('returns the full range when rowHeight is 0 (not measured)', () => {
      expect(computeWindow({ ...base, total: 100, viewportHeight: 500, rowHeight: 0 })).toEqual({
        start: 0,
        end: 100,
        topPad: 0,
        bottomPad: 0,
      });
    });

    it('returns the full range when viewportHeight is 0 (hidden/zero-height)', () => {
      expect(computeWindow({ ...base, total: 100, viewportHeight: 0, rowHeight: 40 })).toEqual({
        start: 0,
        end: 100,
        topPad: 0,
        bottomPad: 0,
      });
    });

    it('returns the full range when columns < 1', () => {
      expect(computeWindow({ ...base, total: 100, viewportHeight: 500, rowHeight: 40, columns: 0 })).toEqual({
        start: 0,
        end: 100,
        topPad: 0,
        bottomPad: 0,
      });
    });

    it('returns an empty range for an empty list', () => {
      expect(computeWindow({ ...base, total: 0, viewportHeight: 500, rowHeight: 40 })).toEqual({
        start: 0,
        end: 0,
        topPad: 0,
        bottomPad: 0,
      });
    });
  });

  describe('list mode (columns = 1)', () => {
    // 100 rows × 40px, 200px viewport → 5 visible rows, no overscan.
    const listBase: WindowMetrics = {
      ...base,
      total: 100,
      viewportHeight: 200,
      rowHeight: 40,
      columns: 1,
      overscanRows: 0,
    };

    it('windows to the visible rows at the top', () => {
      expect(computeWindow({ ...listBase, scrollTop: 0 })).toEqual({
        start: 0,
        end: 5,
        topPad: 0,
        bottomPad: 95 * 40,
      });
    });

    it('windows to the scrolled-into-view rows in the middle', () => {
      // scrollTop 400 → first visible row 10.
      expect(computeWindow({ ...listBase, scrollTop: 400 })).toEqual({
        start: 10,
        end: 15,
        topPad: 10 * 40,
        bottomPad: 85 * 40,
      });
    });

    it('clamps the window at the bottom of the list', () => {
      // Max real scrollTop = totalHeight - viewportHeight = 100*40 - 200 = 3800
      // → first visible row 95, window runs to the last row (100).
      const result = computeWindow({ ...listBase, scrollTop: 3800 });
      expect(result.end).toBe(100);
      expect(result.bottomPad).toBe(0);
      expect(result.start).toBe(95);
      expect(result.topPad).toBe(95 * 40);
    });

    it('applies overscan above and below without going out of bounds', () => {
      const result = computeWindow({ ...listBase, scrollTop: 400, overscanRows: 3 });
      // firstVisibleRow 10, overscan 3 → startRow 7; visibleRowCount 5 + 6 = 11 → endRow 18.
      expect(result).toEqual({ start: 7, end: 18, topPad: 7 * 40, bottomPad: (100 - 18) * 40 });
    });

    it('does not let overscan push startRow below 0 near the top', () => {
      const result = computeWindow({ ...listBase, scrollTop: 40, overscanRows: 5 });
      expect(result.start).toBe(0);
      expect(result.topPad).toBe(0);
    });
  });

  describe('grid mode (columns > 1)', () => {
    // 100 items, 3 columns → 34 rows; 120px rows, 240px viewport → 2 visible rows.
    const gridBase: WindowMetrics = {
      ...base,
      total: 100,
      viewportHeight: 240,
      rowHeight: 120,
      columns: 3,
      overscanRows: 0,
    };

    it('windows whole rows of columns at the top', () => {
      const result = computeWindow({ ...gridBase, scrollTop: 0 });
      // 2 visible rows × 3 cols = 6 items; 34 total rows → 32 rows below.
      expect(result).toEqual({ start: 0, end: 6, topPad: 0, bottomPad: 32 * 120 });
    });

    it('windows whole rows when scrolled', () => {
      // scrollTop 600 → first visible row 5 → start item 15.
      const result = computeWindow({ ...gridBase, scrollTop: 600 });
      expect(result.start).toBe(15);
      expect(result.end).toBe(15 + 6);
      expect(result.topPad).toBe(5 * 120);
    });

    it('clamps end to total (last partial row) at the bottom', () => {
      // 100 items / 3 cols → last row has 1 item (row 33). Scroll to the end.
      const result = computeWindow({ ...gridBase, scrollTop: 34 * 120 });
      expect(result.end).toBe(100);
      expect(result.bottomPad).toBe(0);
    });
  });
});
