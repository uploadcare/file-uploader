import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VirtualListController, type VirtualListSlice } from './VirtualListController';

// The rendered items with the spacers, as the windowing assertions read them.
const flat = <T>({ rows, topPad, bottomPad }: VirtualListSlice<T>) => ({
  items: rows.map((row) => row.item),
  topPad,
  bottomPad,
});

class FakeHost implements ReactiveControllerHost {
  public readonly controllers: ReactiveController[] = [];
  public updateCount = 0;
  public addController(controller: ReactiveController): void {
    this.controllers.push(controller);
  }
  public removeController(): void {}
  public requestUpdate(): void {
    this.updateCount++;
  }
  public get updateComplete(): Promise<boolean> {
    return Promise.resolve(true);
  }
}

type FakeScrollEl = HTMLElement & { _fire: (type: string) => void; scrollTop: number; clientHeight: number };

const makeScrollEl = (opts: { clientHeight: number; itemHeight: number; hasItem?: boolean }): FakeScrollEl => {
  const listeners: Record<string, Array<() => void>> = {};
  const el = {
    clientHeight: opts.clientHeight,
    scrollTop: 0,
    addEventListener: (type: string, fn: () => void) => {
      const bucket = listeners[type];
      if (bucket) {
        bucket.push(fn);
      } else {
        listeners[type] = [fn];
      }
    },
    removeEventListener: (type: string, fn: () => void) => {
      listeners[type] = (listeners[type] ?? []).filter((l) => l !== fn);
    },
    querySelector: () =>
      opts.hasItem === false
        ? null
        : ({ offsetHeight: opts.itemHeight, matches: () => true } as unknown as HTMLElement),
    _fire: (type: string) => {
      for (const l of listeners[type] ?? []) l();
    },
  };
  return el as unknown as FakeScrollEl;
};

let disconnectSpy: ReturnType<typeof vi.fn<() => void>>;
// Last-created observer's callback, so a test can simulate a resize.
let roCallback: ResizeObserverCallback | null = null;
const fireResize = (height: number): void => {
  roCallback?.([{ contentRect: { height } } as ResizeObserverEntry], {} as ResizeObserver);
};

beforeEach(() => {
  disconnectSpy = vi.fn<() => void>();
  roCallback = null;
  vi.stubGlobal(
    'ResizeObserver',
    class {
      public constructor(cb: ResizeObserverCallback) {
        roCallback = cb;
      }
      public observe(): void {}
      public unobserve(): void {}
      public disconnect(): void {
        disconnectSpy();
      }
    },
  );
  // Run rAF synchronously so scroll handling is testable without a real frame.
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0);
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const listOf = (n: number): readonly { id: number }[] => Array.from({ length: n }, (_, i) => ({ id: i }));

describe('VirtualListController', () => {
  it('registers itself on the host', () => {
    const host = new FakeHost();
    const controller = new VirtualListController(host, {
      scrollContainer: () => null,
      itemSelector: 'x',
      rowMetrics: () => ({ columns: 1, rowHeight: 0 }),
    });
    expect(host.controllers).toContain(controller);
  });

  it('renders the FULL list with no spacers before any measurement', () => {
    const host = new FakeHost();
    const controller = new VirtualListController(host, {
      scrollContainer: () => null,
      itemSelector: 'x',
      rowMetrics: () => ({ columns: 1, rowHeight: 40 }),
    });
    const items = listOf(100);
    expect(flat(controller.window(items))).toEqual({ items, topPad: 0, bottomPad: 0 });
  });

  it('renders the full list when the scroll container is never found', () => {
    const host = new FakeHost();
    const controller = new VirtualListController(host, {
      scrollContainer: () => null,
      itemSelector: 'x',
      rowMetrics: () => ({ columns: 1, rowHeight: 40 }),
    });
    controller.hostUpdated();
    const items = listOf(50);
    expect(flat(controller.window(items)).items).toHaveLength(50);
  });

  it('windows to the visible slice + spacers once measured', () => {
    const host = new FakeHost();
    const scrollEl = makeScrollEl({ clientHeight: 200, itemHeight: 40 });
    const controller = new VirtualListController(host, {
      scrollContainer: () => scrollEl,
      itemSelector: 'x',
      rowMetrics: (_el, firstItem) => ({ columns: 1, rowHeight: firstItem.offsetHeight }),
      overscanRows: 0,
    });

    controller.hostUpdated(); // measure: viewport 200, rowHeight 40, columns 1
    expect(host.updateCount).toBeGreaterThan(0);

    const slice = flat(controller.window(listOf(100)));
    expect(slice.items).toHaveLength(5); // ceil(200/40)
    expect(slice.topPad).toBe(0);
    expect(slice.bottomPad).toBe(95 * 40);
  });

  it('re-windows on scroll (rAF-coalesced) and requests a host update', () => {
    const host = new FakeHost();
    const scrollEl = makeScrollEl({ clientHeight: 200, itemHeight: 40 });
    const controller = new VirtualListController(host, {
      scrollContainer: () => scrollEl,
      itemSelector: 'x',
      rowMetrics: (_el, firstItem) => ({ columns: 1, rowHeight: firstItem.offsetHeight }),
      overscanRows: 0,
    });
    controller.hostUpdated();

    scrollEl.scrollTop = 400;
    const before = host.updateCount;
    scrollEl._fire('scroll');
    expect(host.updateCount).toBe(before + 1);

    const slice = flat(controller.window(listOf(100)));
    // scrollTop 400 / 40 = row 10 → window [10, 15).
    expect(slice.items).toEqual(listOf(100).slice(10, 15));
    expect(slice.topPad).toBe(10 * 40);
  });

  it('folds columns for a grid: whole rows of N per window row', () => {
    const host = new FakeHost();
    const scrollEl = makeScrollEl({ clientHeight: 240, itemHeight: 100 });
    const controller = new VirtualListController(host, {
      scrollContainer: () => scrollEl,
      itemSelector: 'x',
      // grid: 3 columns, +20px inter-row gap → rowHeight 120.
      rowMetrics: (_el, firstItem) => ({ columns: 3, rowHeight: firstItem.offsetHeight + 20 }),
      overscanRows: 0,
    });
    controller.hostUpdated();

    const slice = flat(controller.window(listOf(100)));
    // ceil(240/120) = 2 rows × 3 cols = 6 items.
    expect(slice.items).toHaveLength(6);
  });

  it('latches row metrics: a later differently-sized first row does not re-window or loop (regression: scroll hang)', () => {
    const host = new FakeHost();
    // A mutable first item — simulates the window shifting to a taller/empty row.
    const firstItem = { offsetHeight: 40, matches: () => true };
    const scrollEl = {
      clientHeight: 200,
      scrollTop: 0,
      addEventListener: () => {},
      removeEventListener: () => {},
      querySelector: () => firstItem as unknown as HTMLElement,
    } as unknown as HTMLElement;
    const controller = new VirtualListController(host, {
      scrollContainer: () => scrollEl,
      itemSelector: 'x',
      rowMetrics: (_el, item) => ({ columns: 1, rowHeight: item.offsetHeight }),
      overscanRows: 0,
    });

    controller.hostUpdated(); // measure rowHeight 40 → 200/40 = 5 rows
    expect(flat(controller.window(listOf(100))).items).toHaveLength(5);
    const settledCount = host.updateCount;

    // The measured "first item" is now a different, taller row (variable heights).
    firstItem.offsetHeight = 80;
    controller.hostUpdated();

    // Latched: still 40 → 5 rows, and NO further update scheduled (converged — the
    // scroll-hang loop was rowHeight oscillating between renders).
    expect(flat(controller.window(listOf(100))).items).toHaveLength(5);
    expect(host.updateCount).toBe(settledCount);
  });

  it('tracks viewport height via the ResizeObserver (not a per-render layout read)', () => {
    const host = new FakeHost();
    const firstItem = { offsetHeight: 40, matches: () => true };
    const scrollEl = {
      clientHeight: 200,
      scrollTop: 0,
      addEventListener: () => {},
      removeEventListener: () => {},
      querySelector: () => firstItem as unknown as HTMLElement,
    } as unknown as HTMLElement;
    const controller = new VirtualListController(host, {
      scrollContainer: () => scrollEl,
      itemSelector: 'x',
      rowMetrics: (_el, item) => ({ columns: 1, rowHeight: item.offsetHeight }),
      overscanRows: 0,
    });
    controller.hostUpdated(); // seeds viewport 200 on attach, latches rowHeight 40
    expect(flat(controller.window(listOf(100))).items).toHaveLength(5); // 200/40

    // A resize is delivered through the observer, not a render-time clientHeight read.
    fireResize(400);
    expect(flat(controller.window(listOf(100))).items).toHaveLength(10); // 400/40
  });

  it('seeds scrollTop from the container on attach (reconnect to an already-scrolled list)', () => {
    const host = new FakeHost();
    const firstItem = { offsetHeight: 40, matches: () => true };
    const scrollEl = {
      clientHeight: 200,
      scrollTop: 400, // already scrolled before the controller attaches
      addEventListener: () => {},
      removeEventListener: () => {},
      querySelector: () => firstItem as unknown as HTMLElement,
    } as unknown as HTMLElement;
    const controller = new VirtualListController(host, {
      scrollContainer: () => scrollEl,
      itemSelector: 'x',
      rowMetrics: (_el, item) => ({ columns: 1, rowHeight: item.offsetHeight }),
      overscanRows: 0,
    });

    controller.hostUpdated(); // attach seeds scrollTop 400 (no scroll event fired)
    // 400 / 40 = row 10 → topPad reflects the 10 skipped rows without a scroll event.
    expect(flat(controller.window(listOf(100))).topPad).toBe(10 * 40);
  });

  it('clamps a negative overscanRows to 0', () => {
    const host = new FakeHost();
    const scrollEl = makeScrollEl({ clientHeight: 200, itemHeight: 40 });
    const controller = new VirtualListController(host, {
      scrollContainer: () => scrollEl,
      itemSelector: 'x',
      rowMetrics: (_el, item) => ({ columns: 1, rowHeight: item.offsetHeight }),
      overscanRows: -5,
    });
    controller.hostUpdated();
    const slice = flat(controller.window(listOf(100)));
    expect(slice.topPad).toBe(0); // starts at the top
    expect(slice.items).toHaveLength(5); // ceil(200/40), no negative overscan blowup
  });

  it('re-measures row metrics after invalidate() (mode change / resize)', () => {
    const host = new FakeHost();
    const firstItem = { offsetHeight: 40, matches: () => true };
    const scrollEl = {
      clientHeight: 240,
      scrollTop: 0,
      addEventListener: () => {},
      removeEventListener: () => {},
      querySelector: () => firstItem as unknown as HTMLElement,
    } as unknown as HTMLElement;
    const controller = new VirtualListController(host, {
      scrollContainer: () => scrollEl,
      itemSelector: 'x',
      rowMetrics: (_el, item) => ({ columns: 1, rowHeight: item.offsetHeight }),
      overscanRows: 0,
    });
    controller.hostUpdated();
    expect(flat(controller.window(listOf(100))).items).toHaveLength(6); // 240/40

    // Layout changed (e.g. list → grid): invalidate, then the next measure re-reads.
    firstItem.offsetHeight = 120;
    controller.invalidate();
    controller.hostUpdated();
    expect(flat(controller.window(listOf(100))).items).toHaveLength(2); // 240/120
  });

  it('tears down the scroll listener + observer on host disconnect', () => {
    const host = new FakeHost();
    const scrollEl = makeScrollEl({ clientHeight: 200, itemHeight: 40 });
    const removeSpy = vi.spyOn(scrollEl, 'removeEventListener');
    const controller = new VirtualListController(host, {
      scrollContainer: () => scrollEl,
      itemSelector: 'x',
      rowMetrics: (_el, firstItem) => ({ columns: 1, rowHeight: firstItem.offsetHeight }),
    });
    controller.hostUpdated(); // attaches listener + observer

    controller.hostDisconnected();
    expect(removeSpy).toHaveBeenCalledWith('scroll', expect.any(Function));
    expect(disconnectSpy).toHaveBeenCalled();
  });
});

describe('VirtualListController in a container that does not scroll', () => {
  const growingScrollEl = (height: number) =>
    ({
      clientHeight: height,
      scrollHeight: height,
      scrollTop: 0,
      addEventListener: () => {},
      removeEventListener: () => {},
      // Taller than the average row, as the first row of a real list can be: 4000px of content / 50 = 80 rows.
      querySelector: () => ({ offsetHeight: 50, matches: () => true }) as unknown as HTMLElement,
    }) as unknown as { clientHeight: number; scrollHeight: number } & HTMLElement;

  it('renders the full list when the container grows with its content (the page scrolls instead)', () => {
    const host = new FakeHost();
    const scrollEl = growingScrollEl(4000);
    const controller = new VirtualListController(host, {
      scrollContainer: () => scrollEl,
      itemSelector: 'x',
      rowMetrics: (_el, item) => ({ columns: 1, rowHeight: item.offsetHeight }),
      overscanRows: 0,
    });
    controller.hostUpdated();
    const items = listOf(100);
    expect(flat(controller.window(items))).toEqual({ items, topPad: 0, bottomPad: 0 });
  });

  it('stops windowing once a resize leaves the container unbounded', () => {
    const host = new FakeHost();
    const scrollEl = growingScrollEl(200);
    scrollEl.scrollHeight = 4000;
    const controller = new VirtualListController(host, {
      scrollContainer: () => scrollEl,
      itemSelector: 'x',
      rowMetrics: (_el, item) => ({ columns: 1, rowHeight: item.offsetHeight }),
      overscanRows: 0,
    });
    controller.hostUpdated();
    expect(flat(controller.window(listOf(100))).items).toHaveLength(4);

    scrollEl.clientHeight = 4000;
    fireResize(4000);
    controller.hostUpdated();
    expect(flat(controller.window(listOf(100))).items).toHaveLength(100);
  });
});

describe('VirtualListController row height estimate', () => {
  type FakeRow = { offsetHeight: number; nextElementSibling: FakeRow | null; matches: () => boolean };
  const rowsOf = (...heights: number[]): FakeRow[] => {
    const rows: FakeRow[] = heights.map((offsetHeight) => ({
      offsetHeight,
      nextElementSibling: null,
      matches: () => true,
    }));
    rows.forEach((row, i) => {
      row.nextElementSibling = rows[i + 1] ?? null;
    });
    return rows;
  };
  const resizeRows = (rows: readonly FakeRow[], heights: readonly number[]): void => {
    const entries = rows.map((target, i) => ({ target, borderBoxSize: [{ blockSize: heights[i] }] }));
    roCallback?.(entries as unknown as ResizeObserverEntry[], {} as ResizeObserver);
  };
  const setup = (rows: readonly FakeRow[], gap = 0) => {
    const host = new FakeHost();
    const scrollEl = {
      clientHeight: 200,
      scrollTop: 0,
      addEventListener: () => {},
      removeEventListener: () => {},
      querySelector: () => rows[0],
    } as unknown as HTMLElement;
    const controller = new VirtualListController(host, {
      scrollContainer: () => scrollEl,
      itemSelector: 'x',
      rowMetrics: (_el, item) => ({ columns: 1, rowHeight: item.offsetHeight + gap }),
      overscanRows: 0,
    });
    controller.hostUpdated(); // latches the first row's height
    controller.window(listOf(100));
    controller.hostUpdated(); // observes the rendered rows
    return { host, controller };
  };

  it('averages the rendered rows once they report their size, instead of trusting the first one', () => {
    const rows = rowsOf(13, 13, 13, 13);
    const { host, controller } = setup(rows);
    expect(flat(controller.window(listOf(100))).bottomPad).toBe(84 * 13);

    const before = host.updateCount;
    resizeRows(rows, [80, 40, 60, 60]);
    expect(host.updateCount).toBeGreaterThan(before);
    const slice = flat(controller.window(listOf(100)));
    expect(slice.items).toHaveLength(4); // ceil(200 / 60)
    expect(slice.bottomPad).toBe(96 * 60);
  });

  it('ignores a row measured with no layout', () => {
    const rows = rowsOf(40, 40);
    const { controller } = setup(rows);
    resizeRows(rows, [0, 0]);
    expect(flat(controller.window(listOf(100))).bottomPad).toBe(95 * 40);
  });

  it('keeps the inter-row gap rowMetrics adds to an item', () => {
    const rows = rowsOf(100, 100);
    const { controller } = setup(rows, 20);
    resizeRows(rows, [80, 80]);
    expect(flat(controller.window(listOf(100))).bottomPad).toBe(98 * 100); // 80 + 20 gap
  });

  it('observes only the rows, not a spacer rendered between them', () => {
    // Five rows in the window (200 / 40), with a spacer as the third sibling.
    const siblings = rowsOf(40, 40, 0, 40, 40, 40);
    const spacer = siblings[2];
    if (!spacer) throw new Error('no spacer');
    spacer.matches = () => false;
    const rows = siblings.filter((row) => row !== spacer);
    const { controller } = setup(siblings);
    // Counting the spacer as a row would leave the fifth row unobserved, and its height out of the average.
    resizeRows(rows, [40, 40, 40, 40, 100]);
    expect(flat(controller.window(listOf(100))).items).toHaveLength(4); // ceil(200 / 52)
  });
});

describe('VirtualListController pinned item', () => {
  const setup = () => {
    const host = new FakeHost();
    const scrollEl = makeScrollEl({ clientHeight: 200, itemHeight: 40 });
    const controller = new VirtualListController(host, {
      scrollContainer: () => scrollEl,
      itemSelector: 'x',
      rowMetrics: (_el, firstItem) => ({ columns: 1, rowHeight: firstItem.offsetHeight }),
      overscanRows: 0,
    });
    controller.hostUpdated();
    return { controller, scrollEl };
  };
  const items = listOf(100);

  it('renders a pinned item below the window, at its index, after a spacer for the rows between', () => {
    const { controller } = setup();
    const { rows, topPad, bottomPad } = controller.window(items, 50);
    expect(rows.map((row) => row.index)).toEqual([0, 1, 2, 3, 4, 50]);
    expect(rows.at(-1)).toEqual({ item: items[50], index: 50, padBefore: 45 * 40 });
    expect(rows.slice(0, -1).every((row) => row.padBefore === 0)).toBe(true);
    expect(topPad).toBe(0);
    expect(bottomPad).toBe(49 * 40);
  });

  it('renders a pinned item above the window first, and the spacer before the window', () => {
    const { controller, scrollEl } = setup();
    scrollEl.scrollTop = 80 * 40;
    scrollEl._fire('scroll');
    const { rows, topPad } = controller.window(items, 2);
    expect(rows.map((row) => row.index)).toEqual([2, 80, 81, 82, 83, 84]);
    expect(rows.map((row) => row.padBefore)).toEqual([0, 77 * 40, 0, 0, 0, 0]);
    expect(topPad).toBe(2 * 40);
  });

  it('renders a pinned item in the window once, where it belongs', () => {
    const { controller } = setup();
    const { rows } = controller.window(items, 3);
    expect(rows.map((row) => row.index)).toEqual([0, 1, 2, 3, 4]);
  });

  it('ignores a pin that is not in the list', () => {
    const { controller } = setup();
    expect(controller.window(items, -1).rows.map((row) => row.index)).toEqual([0, 1, 2, 3, 4]);
    expect(controller.window(items, 100).rows.map((row) => row.index)).toEqual([0, 1, 2, 3, 4]);
  });
});
