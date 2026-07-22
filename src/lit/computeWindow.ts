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
 * Fixed-row-height model — both view modes render uniform rows in practice (list
 * rows are pinned to `min-height: --uc-file-item-height`; grid cells are a fixed
 * `--uc-grid-preview-image-height`). `columns` folds the flex-wrap grid onto the
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
  const firstVisibleRow = Math.floor(Math.max(0, scrollTop) / rowHeight);
  const startRow = Math.max(0, firstVisibleRow - overscanRows);
  const visibleRowCount = Math.ceil(viewportHeight / rowHeight) + overscanRows * 2;
  const endRow = Math.min(totalRows, startRow + visibleRowCount);

  const start = startRow * columns;
  const end = Math.min(total, endRow * columns);
  const topPad = startRow * rowHeight;
  const bottomPad = (totalRows - endRow) * rowHeight;

  return { start, end, topPad, bottomPad };
}
