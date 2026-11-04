import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { computeWindow } from './computeWindow';

export type VirtualListRowMetrics = {
  /** Columns per row (1 for a vertical list, N for a wrapped grid). */
  columns: number;
  /** Measured height of one row in px — the item box plus the inter-row gap in grid mode. */
  rowHeight: number;
};

export type VirtualListSlice<T> = {
  /** The items to actually render this frame (the visible window + overscan). */
  items: readonly T[];
  /** Spacer height above the window, in px (preserves scroll height). */
  topPad: number;
  /** Spacer height below the window, in px. */
  bottomPad: number;
};

export type VirtualListOptions = {
  /**
   * Locate the scroll container in the host's DOM. Re-queried each render, so a
   * host that renders into light DOM (this repo's `LightDomMixin`) just returns
   * `this.querySelector('.scroller')`.
   */
  scrollContainer: () => HTMLElement | null;
  /**
   * Selector for a rendered row inside the scroll container, used to measure row height. The rendered rows must be
   * consecutive element siblings, in `window()` order.
   */
  itemSelector: string;
  /**
   * Derive the row metrics from the live container + its first rendered item.
   * App-specific (list vs grid, CSS-variable-driven columns/gap), so the host
   * supplies it. Return `rowHeight: 0` when it can't be measured — the controller
   * then renders the full list (no virtualization), which is the safe default.
   * The rendered rows' measured heights then replace the item's `offsetHeight`
   * in that estimate; what `rowHeight` adds on top of it (a grid's row gap) is kept.
   */
  rowMetrics: (scrollContainer: HTMLElement, firstItem: HTMLElement) => VirtualListRowMetrics;
  /** Extra rows rendered above and below the viewport to hide scroll-in latency (default 4). */
  overscanRows?: number;
};

/**
 * Reusable list virtualization as a Lit {@link ReactiveController}: it measures a
 * host-owned scroll container after each render, tracks scroll/resize, and turns
 * an item array into the visible window (+ overscan) plus the top/bottom spacer
 * heights that keep the scrollbar sized as if the whole list were laid out.
 *
 * It attaches to the host's OWN scroll element rather than wrapping the list in a
 * new element — so it never disturbs the host's DOM structure or CSS (important
 * where theming and grid/flex layout target specific light-DOM selectors). Any
 * block can add one, point it at its scroller, and render `controller.window(items)`.
 *
 * Fully degrades to non-virtualized rendering whenever the geometry can't be
 * measured (a non-laid-out environment, a hidden/zero-height container, or the
 * pre-measurement first paint): {@link computeWindow} returns the full range with
 * no spacers, so the host renders its original array unchanged.
 */
export class VirtualListController implements ReactiveController {
  private readonly _host: ReactiveControllerHost;
  private readonly _scrollContainer: () => HTMLElement | null;
  private readonly _itemSelector: string;
  private readonly _rowMetrics: VirtualListOptions['rowMetrics'];
  private readonly _overscanRows: number;

  private _scrollEl: HTMLElement | null = null;
  private _resizeObserver?: ResizeObserver;
  private _rafId = 0;
  private _measureRafId = 0;

  private _scrollTop = 0;
  private _viewportHeight = 0;
  private _rowHeight = 0;
  private _columns = 1;
  // Row metrics are seeded ONCE from the first row and latched. Re-measuring the current first row
  // every render is circular — the window decides which row is first, and rows are
  // not perfectly uniform — so it oscillates and never settles (a scroll hang).
  // `invalidate()` / a resize clears the latch to re-measure once.
  private _measured = false;
  // What rowMetrics adds to an item's own height (a grid's row gap).
  private _rowExtra = 0;
  // The latched row height is only a seed: a row measured early can be collapsed (the modal's opening layout), and
  // rows differ (a row not yet scrolled into view is a shorter shell). The ResizeObserver reports each rendered row,
  // and the estimate follows their average height (0 = not reported yet).
  private _rows = new Map<Element, number>();
  // A row the window just dropped can still be in this frame's resize entries: it must not read as the container.
  private _everObservedRows = new WeakSet<Element>();
  private _windowedCount = 0;

  public constructor(host: ReactiveControllerHost, options: VirtualListOptions) {
    this._host = host;
    this._scrollContainer = options.scrollContainer;
    this._itemSelector = options.itemSelector;
    this._rowMetrics = options.rowMetrics;
    // Clamp to >= 0: a negative overscan would shrink the window / yield a bad slice.
    this._overscanRows = Math.max(0, options.overscanRows ?? 4);
    host.addController(this);
  }

  public hostUpdated(): void {
    this._measure();
  }

  public hostDisconnected(): void {
    this._detach();
  }

  /**
   * Drop the latched row metrics so they are re-measured on the next render.
   * Call when a layout change can alter row height/columns (e.g. a list⇆grid
   * view-mode switch) — a resize is handled automatically.
   */
  public invalidate(): void {
    this._unlatch();
    this._rowHeight = 0;
    this._columns = 1;
    this._host.requestUpdate();
  }

  /**
   * Slice `items` down to the current window. Call in the host's `render()`.
   * `topPad`/`bottomPad` are the heights of full-width spacer elements the host
   * renders before/after the windowed items.
   */
  public window<T>(items: readonly T[]): VirtualListSlice<T> {
    const slice = computeWindow({
      total: items.length,
      scrollTop: this._scrollTop,
      viewportHeight: this._viewportHeight,
      rowHeight: this._rowHeight,
      columns: this._columns,
      overscanRows: this._overscanRows,
    });
    const windowed = slice.start === 0 && slice.end === items.length ? items : items.slice(slice.start, slice.end);
    this._windowedCount = windowed.length;
    return { items: windowed, topPad: slice.topPad, bottomPad: slice.bottomPad };
  }

  // rAF-coalesced: a scroll burst updates `_scrollTop` at most once per frame,
  // then re-renders the host (which re-windows).
  private _onScroll = (): void => {
    if (this._rafId) {
      return;
    }
    this._rafId = requestAnimationFrame(() => {
      this._rafId = 0;
      const top = this._scrollEl?.scrollTop ?? 0;
      if (top !== this._scrollTop) {
        this._scrollTop = top;
        this._host.requestUpdate();
      }
    });
  };

  // Measure geometry after each render and lazily wire the scroll listener + a
  // ResizeObserver. Viewport height is seeded with ONE layout read on attach and
  // then owned by the ResizeObserver — steady-state renders do NOT read
  // `clientHeight`, so a scroll/re-render doesn't force a layout — except while
  // unlatched, when each render reads `scrollHeight`/`clientHeight` to tell a
  // container that grows with its rows (never virtualized) from one that
  // overflows. Row metrics are
  // seeded ONCE and latched (`_measured`) — measuring them every render is
  // circular (see the field note) and hangs; a resize clears the latch so they
  // re-measure. Once latched, the rendered rows are observed and their average
  // height replaces the seed (`_onRowsResize`). The measurement-driven re-render is scheduled OUTSIDE the update
  // lifecycle (rAF) so it never trips Lit's change-in-update warning.
  private _measure(): void {
    const scrollEl = this._scrollContainer();
    if (!scrollEl) {
      return;
    }
    if (this._scrollEl !== scrollEl) {
      this._detach();
      this._scrollEl = scrollEl;
      this._unlatch();
      scrollEl.addEventListener('scroll', this._onScroll, { passive: true });
      // Seed viewport + scroll offset once (a reconnect/restore can attach to an
      // already-scrolled container; without this `_scrollTop` stays 0 until the
      // next scroll event and the first window would be wrong). The observer +
      // scroll listener own them thereafter (no per-render layout read).
      this._viewportHeight = scrollEl.clientHeight;
      this._scrollTop = scrollEl.scrollTop;
      this._resizeObserver = new ResizeObserver((entries) => {
        // One observer watches the container and the rendered rows.
        this._onRowsResize(entries);
        const container = entries.find((entry) => !this._everObservedRows.has(entry.target));
        if (!container) {
          return;
        }
        const height = container.contentRect.height;
        // A resize can change viewport AND row metrics (grid cell height scales
        // with width via aspect-ratio), so re-latch. This callback runs outside
        // the update lifecycle → direct requestUpdate is safe.
        if (height !== this._viewportHeight || this._measured) {
          this._viewportHeight = height;
          this._unlatch();
          this._host.requestUpdate();
        }
      });
      this._resizeObserver.observe(scrollEl);
    }

    if (!this._measured) {
      // A container that grows with its content (an unsized inline uploader, where the page scrolls) never scrolls,
      // so its clientHeight is the whole list, not a viewport: render every row. Checked until the list overflows.
      // 1px tolerance: sub-pixel row heights can round scrollHeight one past clientHeight.
      if (scrollEl.scrollHeight - scrollEl.clientHeight <= 1) {
        if (this._rowHeight > 0) {
          this._rowHeight = 0;
          this._scheduleMeasureUpdate();
        }
        return;
      }
      const firstItem = scrollEl.querySelector<HTMLElement>(this._itemSelector);
      if (firstItem) {
        const { columns, rowHeight } = this._rowMetrics(scrollEl, firstItem);
        if (rowHeight > 0) {
          this._columns = columns >= 1 ? columns : 1;
          this._rowHeight = rowHeight;
          this._rowExtra = rowHeight - firstItem.offsetHeight;
          this._measured = true;
          this._scheduleMeasureUpdate();
        }
      }
      // The rows are observed from the windowed render the latch schedules, not this unwindowed one.
      return;
    }
    this._observeRows(scrollEl.querySelector(this._itemSelector));
  }

  // Observe the rendered rows (cheap: no layout read) and stop observing the ones the window dropped.
  private _observeRows(firstRow: Element | null): void {
    const rows = new Map<Element, number>();
    let row = firstRow;
    for (let i = 0; row && i < this._windowedCount; i++, row = row.nextElementSibling) {
      const height = this._rows.get(row);
      rows.set(row, height ?? 0);
      if (height === undefined) {
        this._resizeObserver?.observe(row);
        this._everObservedRows.add(row);
      }
    }
    for (const old of this._rows.keys()) {
      if (!rows.has(old)) {
        this._resizeObserver?.unobserve(old);
      }
    }
    this._rows = rows;
  }

  private _onRowsResize(entries: readonly ResizeObserverEntry[]): void {
    for (const entry of entries) {
      // A row with no layout (a hidden panel) says nothing about its height.
      const height = this._rows.has(entry.target) ? (entry.borderBoxSize[0]?.blockSize ?? 0) : 0;
      if (height > 0) {
        this._rows.set(entry.target, height);
      }
    }
    const measured = [...this._rows.values()].filter((height) => height > 0);
    if (!this._measured || !measured.length) {
      return;
    }
    const rowHeight = measured.reduce((sum, height) => sum + height, 0) / measured.length + this._rowExtra;
    // The average moves with the window, and the window with the average: ignore a sub-pixel change so the two settle.
    if (Math.abs(rowHeight - this._rowHeight) >= 0.5) {
      this._rowHeight = rowHeight;
      this._host.requestUpdate();
    }
  }

  // Drop the latched metrics and stop observing rows: once re-latched, the rows are re-observed and report their sizes.
  private _unlatch(): void {
    this._measured = false;
    this._observeRows(null);
  }

  // Re-render after a measurement change, but deferred to the next frame so the
  // `requestUpdate` lands outside the update lifecycle (no change-in-update warning).
  private _scheduleMeasureUpdate(): void {
    if (this._measureRafId) {
      return;
    }
    this._measureRafId = requestAnimationFrame(() => {
      this._measureRafId = 0;
      this._host.requestUpdate();
    });
  }

  private _detach(): void {
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = 0;
    }
    if (this._measureRafId) {
      cancelAnimationFrame(this._measureRafId);
      this._measureRafId = 0;
    }
    this._scrollEl?.removeEventListener('scroll', this._onScroll);
    this._scrollEl = null;
    this._resizeObserver?.disconnect();
    this._resizeObserver = undefined;
    this._rows.clear();
  }
}
