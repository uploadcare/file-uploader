export type WindowMetrics = {
  /** Total number of items in the list. */
  total: number;
  /** Current scroll offset of the scroll container, in px. */
  scrollTop: number;
  /** Visible height of the scroll container, in px. */
  viewportHeight: number;
  /** Measured height of one row, in px (item height, plus the inter-row gap in grid mode). */
  rowHeight: number;
  /** Columns per row (1 in list mode, `--uc-grid-col` in grid mode). */
  columns: number;
  /** Extra rows rendered above and below the viewport to hide scroll-in latency. */
  overscanRows: number;
};

export type WindowSlice = {
  /** Inclusive start index into the item list. */
  start: number;
  /** Exclusive end index into the item list. */
  end: number;
  /** Spacer height above the rendered window, in px (preserves scroll height). */
  topPad: number;
  /** Spacer height below the rendered window, in px. */
  bottomPad: number;
};

/**
 * Pure windowing math for {@link UploadList}: given the scroll geometry, return
 * the `[start, end)` slice of items to render plus the top/bottom spacer heights
 * that keep the scrollbar sized as if the whole list were laid out.
 *
 * Fixed-row-height model — rows are close to uniform (list rows are pinned to
 * `min-height: --uc-file-item-height`; grid cells are a fixed
 * `--uc-grid-preview-image-height`), and {@link VirtualListController} passes the
 * rendered rows' average height. `columns` folds the flex-wrap grid onto the
 * same row math.
 *
 * Degrades safely: when the geometry can't be measured yet (`rowHeight`/
 * `viewportHeight` still 0 — happy-dom, a hidden or zero-height container, the
 * pre-measurement first paint) or the list is empty, it returns the FULL range
 * with no spacers, i.e. exactly the non-virtualized behavior. Callers can render
 * the original array unchanged in that case.
 */
export function computeWindow(metrics: WindowMetrics): WindowSlice {
  const { total, scrollTop, viewportHeight, rowHeight, columns, overscanRows } = metrics;

  if (total <= 0 || rowHeight <= 0 || viewportHeight <= 0 || columns < 1) {
    return { start: 0, end: total > 0 ? total : 0, topPad: 0, bottomPad: 0 };
  }

  const totalRows = Math.ceil(total / columns);
  // Clamp scrollTop to the real scrollable range. A stale/oversized offset — the
  // list shrank while scrolled deep, or an over-scroll the browser clamped
  // without firing `scroll` — would otherwise push `firstVisibleRow` past the
  // last row, making `start > end` (an empty window with a huge top spacer, i.e.
  // a blank list). Clamping snaps the window to the last page instead.
  const maxScrollTop = Math.max(0, totalRows * rowHeight - viewportHeight);
  const clampedScrollTop = Math.min(Math.max(0, scrollTop), maxScrollTop);
  const firstVisibleRow = Math.floor(clampedScrollTop / rowHeight);
  const startRow = Math.max(0, firstVisibleRow - overscanRows);
  const visibleRowCount = Math.ceil(viewportHeight / rowHeight) + overscanRows * 2;
  const endRow = Math.min(totalRows, startRow + visibleRowCount);

  const start = startRow * columns;
  const end = Math.min(total, endRow * columns);
  const topPad = startRow * rowHeight;
  const bottomPad = (totalRows - endRow) * rowHeight;

  return { start, end, topPad, bottomPad };
}

export type PinnedWindowSlice = WindowSlice & {
  /** The pinned item's index when it renders outside `[start, end)`, else -1. */
  pinned: number;
  /** Spacer height between the pinned item and the window, in px (0 without a pin outside the window). */
  gapPad: number;
};

/**
 * Keeps item `pinned` (the list's current row) rendered when the window scrolled away from it, so focus on it
 * survives a scroll. The pinned item stands in for its whole row, alone on a flex line in a grid, and the rows
 * between it and the window become one more spacer, so every rendered row keeps its offset. A pin on the row next to
 * the window just widens the window by that row: nothing of zero height could break a grid line there without adding
 * a gap.
 */
export function pinWindow(
  slice: WindowSlice,
  { pinned, total, rowHeight, columns }: Pick<WindowMetrics, 'total' | 'rowHeight' | 'columns'> & { pinned: number },
): PinnedWindowSlice {
  if (pinned < 0 || pinned >= total || rowHeight <= 0 || (pinned >= slice.start && pinned < slice.end)) {
    return { ...slice, pinned: -1, gapPad: 0 };
  }
  const row = Math.floor(pinned / columns);
  const startRow = Math.floor(slice.start / columns);
  const endRow = Math.ceil(slice.end / columns);
  if (row === startRow - 1) {
    return { ...slice, start: row * columns, topPad: slice.topPad - rowHeight, pinned: -1, gapPad: 0 };
  }
  if (row === endRow) {
    const end = Math.min(total, (row + 1) * columns);
    return { ...slice, end, bottomPad: slice.bottomPad - rowHeight, pinned: -1, gapPad: 0 };
  }
  if (row < startRow) {
    return { ...slice, topPad: row * rowHeight, gapPad: (startRow - row - 1) * rowHeight, pinned };
  }
  const totalRows = Math.ceil(total / columns);
  return { ...slice, gapPad: (row - endRow) * rowHeight, bottomPad: (totalRows - row - 1) * rowHeight, pinned };
}
