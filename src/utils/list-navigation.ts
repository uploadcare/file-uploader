/**
 * Where a key moves the current row of a roving-tabindex list: arrows by one row (ArrowLeft/Right by one cell, in a
 * grid only), Home/End to the ends, PageUp/PageDown by `pageRows` rows. `null` for a key the list does not handle.
 * ArrowDown from a grid's next-to-last row lands on the last item when the cell below is missing. In a right-to-left
 * grid the next cell is to the left.
 */
export function targetRowIndex(
  key: string,
  from: number,
  total: number,
  columns: number,
  pageRows: number,
  rtl = false,
) {
  const last = total - 1;
  const page = Math.max(1, pageRows) * columns;
  const sideways: Record<string, string> = { ArrowLeft: 'ArrowRight', ArrowRight: 'ArrowLeft' };
  switch ((rtl && sideways[key]) || key) {
    case 'ArrowDown':
      return Math.min(from + columns, Math.floor(from / columns) < Math.floor(last / columns) ? last : from);
    case 'ArrowUp':
      return from >= columns ? from - columns : from;
    case 'ArrowRight':
      return columns > 1 ? Math.min(from + 1, last) : null;
    case 'ArrowLeft':
      return columns > 1 ? Math.max(from - 1, 0) : null;
    case 'Home':
      return 0;
    case 'End':
      return last;
    case 'PageDown':
      return Math.min(from + page, last);
    case 'PageUp':
      return Math.max(from - page, 0);
    default:
      return null;
  }
}

/** The row that takes over from `removed`: the next one still in the list, else the previous one, else none. */
export function survivingNeighbour<T>(before: readonly T[], after: readonly T[], removed: T): T | null {
  const kept = new Set(after);
  const at = before.indexOf(removed);
  return (
    before.slice(at + 1).find((item) => kept.has(item)) ??
    before.slice(0, at).findLast((item) => kept.has(item)) ??
    null
  );
}
