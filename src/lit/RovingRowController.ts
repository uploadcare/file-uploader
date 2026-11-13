import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { survivingNeighbour, targetRowIndex } from '../utils/list-navigation';

export type RovingRowOptions<K> = {
  /** The keys of the whole list, in order. Read on each host update: the same array for as long as the list is the same. */
  items: () => readonly K[];
  /** The key of the row an event came from, if it came from one. */
  keyOf: (event: Event) => K | undefined;
  /** The rendered row of `key`. The host keeps the current row rendered (a virtualized one pins it). */
  rowElement: (key: K) => HTMLElement | undefined;
  /** The element holding the rows and nothing else: focus inside it is the list's to move. */
  rowsContainer: () => HTMLElement | undefined;
  /** Rows per visual line (1 for a vertical list). */
  columns: () => number;
  /** How many lines PageUp/PageDown move by. */
  pageRows: () => number;
  /**
   * Run `work` once the host's pending update has rendered. The host owns the wait, so it can drop work that outlives
   * it (a block released mid-update).
   */
  afterUpdate: (work: () => void) => void;
  /** Focus was in the list when its last row was removed. Called once that update has rendered. */
  onEmptied: () => void;
};

/**
 * Roving tabindex for a list of rows, as a Lit {@link ReactiveController}: the list is one Tab stop, its current row
 * (the first until the user moves), and the arrow, Home/End and Page keys move it (see {@link targetRowIndex}). When
 * the current row is removed its neighbour takes over, with focus if the row had it.
 *
 * The host renders `tabindex` from {@link currentIndex} and wires {@link onFocusIn} / {@link onKeyDown} on an
 * ancestor of the rows. Rows are known by key, so the list can be virtualized: only the current row has to be rendered.
 */
export class RovingRowController<K> implements ReactiveController {
  private readonly _host: ReactiveControllerHost;
  private readonly _options: RovingRowOptions<K>;

  private _current: K | null = null;

  // The list the last update rendered, to find the neighbour of a removed current row.
  private _items: readonly K[] = [];

  // Where `_current` sits in `_items` (-1 for none), found again only when either changes: a scroll's render must not
  // search the whole list.
  private _index = -1;
  private _indexed: K | null = null;

  public constructor(host: ReactiveControllerHost, options: RovingRowOptions<K>) {
    this._host = host;
    this._options = options;
    host.addController(this);
  }

  /** The current row's index in the list the host is rendering, -1 before any row was made current. */
  public get currentIndex(): number {
    return this._index;
  }

  public hostUpdate(): void {
    const list = this._options.items();
    if (list !== this._items || this._current !== this._indexed) {
      const indexOf = (key: K | null) => (key === null ? -1 : list.indexOf(key));
      let index = indexOf(this._current);
      if (this._current !== null && index < 0) {
        this._replaceRemoved(list, this._current);
        index = indexOf(this._current);
      }
      this._indexed = this._current;
      this._index = index;
    }
    this._items = list;
  }

  public onFocusIn = (event: FocusEvent): void => {
    const key = this._options.keyOf(event);
    if (key !== undefined) {
      this._setCurrent(key);
    }
  };

  public onKeyDown = (event: KeyboardEvent): void => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }
    const { keyOf, rowsContainer, columns, pageRows } = this._options;
    const key = keyOf(event);
    const list = this._items;
    const from = key === undefined ? -1 : list.indexOf(key);
    const rows = rowsContainer();
    if (from < 0 || !rows) {
      return;
    }
    const rtl = getComputedStyle(rows).direction === 'rtl';
    const to = list[targetRowIndex(event.key, from, list.length, columns(), pageRows(), rtl) ?? -1];
    if (to !== undefined) {
      event.preventDefault();
      // At either end the key has nowhere to go: focus stays where it is, on a button of the row if it was there.
      if (to !== key) this._focusRow(to);
    }
  };

  private _setCurrent(key: K): void {
    if (key !== this._current) {
      this._current = key;
      this._host.requestUpdate();
    }
  }

  // The current row is rendered once this update lands; `focus()` scrolls it into view.
  private _focusRow(key: K): void {
    this._setCurrent(key);
    this._options.afterUpdate(() => this._focusCurrentRow(key));
  }

  // After the update: unless a later move superseded this one, or focus went elsewhere meanwhile (a page handler of
  // the same key). Focus left on the body is the removed row's, still ours to move.
  private _focusCurrentRow(key: K): void {
    if (this._focusIsOurs(true) && this._current === key) {
      this._options.rowElement(key)?.focus();
    }
  }

  private _focusIsOurs(orNowhere: boolean): boolean {
    const active = document.activeElement;
    return !active || active === document.body ? orNowhere : (this._options.rowsContainer()?.contains(active) ?? false);
  }

  // The current row was removed: its neighbour takes over, and takes focus when the row had it. Runs before the
  // update removes the row, while focus is still in it.
  private _replaceRemoved(list: readonly K[], removed: K): void {
    const next = survivingNeighbour(this._items, list, removed);
    this._current = next;
    if (!this._focusIsOurs(false)) {
      return;
    }
    this._options.afterUpdate(() => {
      if (next === null) {
        this._options.onEmptied();
      } else {
        this._focusCurrentRow(next);
      }
    });
  }
}
