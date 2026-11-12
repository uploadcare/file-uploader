import { describe, expect, it } from 'vitest';
import { computeWindow, pinWindow, type WindowMetrics } from './computeWindow';

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
      // 100 items / 3 cols → 34 rows. An over-scroll past the end (34*120) is
      // clamped to the last page: 2 visible rows → start row 32 → item 96.
      const result = computeWindow({ ...gridBase, scrollTop: 34 * 120 });
      expect(result.start).toBe(96);
      expect(result.topPad).toBe(32 * 120);
      expect(result.end).toBe(100);
      expect(result.bottomPad).toBe(0);
    });
  });

  describe('stale / over-scrolled scrollTop → clamped to last page (never an empty window)', () => {
    it('list: a scrollTop far past a shrunken list snaps to the last page', () => {
      // Was 1000+ rows, user scrolled deep (scrollTop 40000), list shrank to 10.
      const result = computeWindow({
        ...base,
        total: 10,
        viewportHeight: 200,
        rowHeight: 40,
        columns: 1,
        overscanRows: 0,
        scrollTop: 40_000,
      });
      // maxScrollTop = 10*40 - 200 = 200 → row 5 → last 5 rows, NOT an empty slice.
      expect(result.start).toBe(5);
      expect(result.end).toBe(10);
      expect(result.topPad).toBe(200);
      expect(result.bottomPad).toBe(0);
      expect(result.end).toBeGreaterThan(result.start);
    });

    it('list shorter than the viewport clamps to the whole list', () => {
      const result = computeWindow({
        ...base,
        total: 3,
        viewportHeight: 500,
        rowHeight: 40,
        columns: 1,
        overscanRows: 0,
        scrollTop: 9999,
      });
      expect(result).toEqual({ start: 0, end: 3, topPad: 0, bottomPad: 0 });
    });

    it('grid: an over-scrolled offset never yields start > end', () => {
      const result = computeWindow({
        ...base,
        total: 100,
        viewportHeight: 240,
        rowHeight: 120,
        columns: 3,
        overscanRows: 0,
        scrollTop: 999_999,
      });
      expect(result.start).toBeLessThan(result.end);
      expect(result.end).toBe(100);
    });
  });
});

describe('pinWindow', () => {
  // 100 rows of 40px; the window is rows 50..60.
  const list = { start: 50, end: 60, topPad: 50 * 40, bottomPad: 40 * 40 };
  const listPin = (pinned: number) => pinWindow(list, { pinned, total: 100, rowHeight: 40, columns: 1 });
  // Whatever the pin, the spacers and rendered rows still add up to the whole list.
  const height = (s: ReturnType<typeof listPin>, columns = 1) =>
    s.topPad +
    s.gapPad +
    s.bottomPad +
    (Math.ceil(s.end / columns) - Math.floor(s.start / columns) + (s.pinned >= 0 ? 1 : 0)) * 40;

  it('changes nothing for a pin inside the window, or no pin', () => {
    expect(listPin(55)).toEqual({ ...list, pinned: -1, gapPad: 0 });
    expect(listPin(-1)).toEqual({ ...list, pinned: -1, gapPad: 0 });
    expect(listPin(100)).toEqual({ ...list, pinned: -1, gapPad: 0 });
  });

  it('changes nothing before the rows are measured, when the window is the whole list', () => {
    const all = { start: 0, end: 100, topPad: 0, bottomPad: 0 };
    expect(pinWindow(all, { pinned: 3, total: 100, rowHeight: 0, columns: 1 })).toEqual({
      ...all,
      pinned: -1,
      gapPad: 0,
    });
  });

  it('renders a pin above the window at its own offset, with the rows between as a spacer', () => {
    expect(listPin(2)).toEqual({ start: 50, end: 60, topPad: 2 * 40, gapPad: 47 * 40, bottomPad: 40 * 40, pinned: 2 });
    expect(height(listPin(2))).toBe(100 * 40);
    expect(listPin(0).topPad).toBe(0);
  });

  it('renders a pin below the window at its own offset', () => {
    expect(listPin(90)).toEqual({
      start: 50,
      end: 60,
      topPad: 50 * 40,
      gapPad: 30 * 40,
      bottomPad: 9 * 40,
      pinned: 90,
    });
    expect(height(listPin(90))).toBe(100 * 40);
    expect(listPin(99).bottomPad).toBe(0);
  });

  it('widens the window by the row next to it instead of a zero-height spacer', () => {
    expect(listPin(49)).toEqual({ start: 49, end: 60, topPad: 49 * 40, bottomPad: 40 * 40, pinned: -1, gapPad: 0 });
    expect(listPin(60)).toEqual({ start: 50, end: 61, topPad: 50 * 40, bottomPad: 39 * 40, pinned: -1, gapPad: 0 });
  });

  it('pins a grid cell on a row of its own', () => {
    // 100 items in 3 columns = 34 rows; the window is rows 10..12 (items 30..36).
    const grid = { start: 30, end: 36, topPad: 10 * 40, bottomPad: 22 * 40 };
    const pin = (pinned: number) => pinWindow(grid, { pinned, total: 100, rowHeight: 40, columns: 3 });
    // Item 7 is on row 2.
    expect(pin(7)).toEqual({ ...grid, topPad: 2 * 40, gapPad: 7 * 40, pinned: 7 });
    expect(height(pin(7), 3)).toBe(34 * 40);
    // Item 99 is alone on the last row, 33.
    expect(pin(99)).toEqual({ ...grid, gapPad: 21 * 40, bottomPad: 0, pinned: 99 });
    expect(height(pin(99), 3)).toBe(34 * 40);
    // Item 37 is on row 12, next to the window: the window takes the whole row.
    expect(pin(37)).toEqual({ ...grid, end: 39, bottomPad: 21 * 40, pinned: -1, gapPad: 0 });
  });
});
