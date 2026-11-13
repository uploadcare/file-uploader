import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RovingRowController } from './RovingRowController';

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

const mounted: HTMLElement[] = [];
afterEach(() => {
  for (const el of mounted.splice(0)) el.remove();
});

/**
 * A list of rows `a`, `b`, … each with a button, rendered whole. `render()` stands for the host's update: the
 * controller's `hostUpdate`, then the rows of the current list, then the work queued for after the update.
 */
const setup = (count: number, geometry: { columns?: number; pageRows?: number; rtl?: boolean } = {}) => {
  const host = new FakeHost();
  const rows = document.createElement('div');
  if (geometry.rtl) rows.style.direction = 'rtl';
  const outside = document.createElement('button');
  document.body.append(rows, outside);
  mounted.push(rows, outside);

  let items: readonly string[] = Array.from({ length: count }, (_, i) => String.fromCharCode(97 + i));
  const afterUpdate: (() => void)[] = [];
  const onEmptied = vi.fn<() => void>();
  const rowOf = (key: string) => rows.querySelector<HTMLElement>(`[data-key="${key}"]`) ?? undefined;
  const controller = new RovingRowController<string>(host, {
    items: () => items,
    keyOf: (event) =>
      event
        .composedPath()
        .find((target): target is HTMLElement => target instanceof HTMLElement && 'key' in target.dataset)?.dataset.key,
    rowElement: rowOf,
    rowsContainer: () => rows,
    columns: () => geometry.columns ?? 1,
    pageRows: () => geometry.pageRows ?? 3,
    afterUpdate: (work) => afterUpdate.push(work),
    onEmptied,
  });
  rows.addEventListener('focusin', controller.onFocusIn);
  rows.addEventListener('keydown', controller.onKeyDown);

  const render = () => {
    controller.hostUpdate();
    for (const row of [...rows.children]) {
      if (!items.includes((row as HTMLElement).dataset.key ?? '')) row.remove();
    }
    for (const key of items) {
      if (!rowOf(key)) {
        const row = document.createElement('div');
        row.dataset.key = key;
        row.tabIndex = -1;
        row.append(document.createElement('button'));
        rows.append(row);
      }
    }
    for (const work of afterUpdate.splice(0)) work();
  };
  render();

  const row = (key: string) => {
    const el = rowOf(key);
    if (!el) throw new Error(`no row ${key}`);
    return el;
  };
  const press = (target: HTMLElement, key: string, init: KeyboardEventInit = {}) => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    return event;
  };
  const current = () => items[controller.currentIndex];
  return {
    host,
    controller,
    outside,
    onEmptied,
    render,
    row,
    press,
    current,
    setItems: (next: readonly string[]) => {
      items = next;
    },
  };
};

describe('RovingRowController', () => {
  it('registers itself on the host and has no current row until one takes focus', () => {
    const { host, controller } = setup(3);
    expect(host.controllers).toContain(controller);
    expect(controller.currentIndex).toBe(-1);
  });

  it('makes the row focus enters current, from the row or from a control inside it', () => {
    const { host, render, row, current } = setup(3);
    row('b').focus();
    expect(host.updateCount).toBe(1);
    render();
    expect(current()).toBe('b');

    row('c').querySelector('button')?.focus();
    render();
    expect(current()).toBe('c');
  });

  it('requests no update when focus moves within the current row', () => {
    const { host, render, row } = setup(3);
    row('b').focus();
    render();
    const before = host.updateCount;
    row('b').querySelector('button')?.focus();
    expect(host.updateCount).toBe(before);
  });

  it('moves the current row with a key and focuses it once the host has rendered', () => {
    const { render, row, press, current } = setup(5);
    row('a').focus();
    render();

    const event = press(row('a'), 'ArrowDown');
    expect(event.defaultPrevented).toBe(true);
    // Not before the update: a virtualized host has yet to render the row.
    expect(document.activeElement).toBe(row('a'));
    render();
    expect(current()).toBe('b');
    expect(document.activeElement).toBe(row('b'));

    press(row('b'), 'End');
    render();
    expect(document.activeElement).toBe(row('e'));
    press(row('e'), 'Home');
    render();
    expect(document.activeElement).toBe(row('a'));
  });

  it('moves from a control inside a row to the next row itself', () => {
    const { render, row, press } = setup(3);
    const button = row('a').querySelector('button');
    if (!button) throw new Error('no button');
    button.focus();
    render();
    press(button, 'ArrowDown');
    render();
    expect(document.activeElement).toBe(row('b'));
  });

  it('moves by the page and the columns the host reports', () => {
    const { render, row, press } = setup(12, { columns: 3, pageRows: 2 });
    row('a').focus();
    render();
    press(row('a'), 'ArrowRight');
    render();
    expect(document.activeElement).toBe(row('b'));
    press(row('b'), 'ArrowDown');
    render();
    expect(document.activeElement).toBe(row('e'));
    press(row('e'), 'PageDown');
    render();
    expect(document.activeElement).toBe(row('k'));
  });

  it('follows the reading direction of the rows', () => {
    const { render, row, press } = setup(6, { columns: 3, rtl: true });
    row('a').focus();
    render();
    press(row('a'), 'ArrowLeft');
    render();
    expect(document.activeElement).toBe(row('b'));
  });

  it('takes a key at either end of the list without moving focus off a control of the row', () => {
    const { host, render, row, press, current } = setup(3);
    const button = row('a').querySelector('button');
    if (!button) throw new Error('no button');
    button.focus();
    render();
    const before = host.updateCount;

    expect(press(button, 'ArrowUp').defaultPrevented).toBe(true);
    expect(press(button, 'Home').defaultPrevented).toBe(true);
    render();
    expect(host.updateCount).toBe(before);
    expect(current()).toBe('a');
    expect(document.activeElement).toBe(button);
  });

  it('leaves alone a key with a modifier, a key it does not handle and a key from outside the rows', () => {
    const { host, controller, render, row, press, outside } = setup(3);
    row('a').focus();
    render();
    const before = host.updateCount;
    outside.addEventListener('keydown', controller.onKeyDown);

    expect(press(row('a'), 'ArrowDown', { shiftKey: true }).defaultPrevented).toBe(false);
    expect(press(row('a'), 'ArrowDown', { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(press(row('a'), 'ArrowDown', { altKey: true }).defaultPrevented).toBe(false);
    expect(press(row('a'), 'ArrowDown', { metaKey: true }).defaultPrevented).toBe(false);
    expect(press(row('a'), 'Enter').defaultPrevented).toBe(false);
    // A one-column list has no sideways move.
    expect(press(row('a'), 'ArrowRight').defaultPrevented).toBe(false);
    expect(press(outside, 'ArrowDown').defaultPrevented).toBe(false);
    expect(host.updateCount).toBe(before);
  });

  it('focuses only the row of the last of two moves made before the host rendered', () => {
    const { render, row, press } = setup(5);
    row('a').focus();
    render();
    const focusB = vi.spyOn(row('b'), 'focus');
    press(row('a'), 'ArrowDown');
    press(row('a'), 'End');
    render();
    expect(focusB).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(row('e'));
  });

  it('leaves focus where something else moved it before the host rendered', () => {
    const { render, row, press, outside, current } = setup(3);
    row('a').focus();
    render();
    press(row('a'), 'ArrowDown');
    outside.focus();
    render();
    // The key still made the next row current.
    expect(current()).toBe('b');
    expect(document.activeElement).toBe(outside);
  });

  it('hands a removed current row on to the next row, with focus when the row had it', () => {
    const { render, row, current, setItems } = setup(4);
    row('b').querySelector('button')?.focus();
    render();

    setItems(['a', 'c', 'd']);
    render();
    expect(current()).toBe('c');
    expect(document.activeElement).toBe(row('c'));
  });

  it('hands a removed last row on to the previous one', () => {
    const { render, row, current, setItems } = setup(3);
    row('c').focus();
    render();

    setItems(['a', 'b']);
    render();
    expect(current()).toBe('b');
    expect(document.activeElement).toBe(row('b'));
  });

  it('moves the current row but not focus when the removed row did not have it', () => {
    const { render, row, outside, current, setItems } = setup(3);
    row('b').focus();
    render();
    outside.focus();

    setItems(['a', 'c']);
    render();
    expect(current()).toBe('c');
    expect(document.activeElement).toBe(outside);
  });

  it('reports the list emptied under focus once that update has rendered', () => {
    const { render, row, onEmptied, controller, setItems } = setup(2);
    row('a').focus();
    render();

    setItems([]);
    render();
    expect(onEmptied).toHaveBeenCalledOnce();
    expect(controller.currentIndex).toBe(-1);
  });

  it('does not report a list emptied while focus was elsewhere', () => {
    const { render, row, outside, onEmptied, setItems } = setup(2);
    row('a').focus();
    render();
    outside.focus();

    setItems([]);
    render();
    expect(onEmptied).not.toHaveBeenCalled();
  });

  it('keeps the current row at its new index when rows before it are removed', () => {
    const { render, row, controller, setItems } = setup(4);
    row('d').focus();
    render();
    expect(controller.currentIndex).toBe(3);

    setItems(['c', 'd']);
    render();
    expect(controller.currentIndex).toBe(1);
  });

  it('searches the list again only when the list or the current row changed', () => {
    const { render, row, setItems } = setup(3);
    const list = ['a', 'b', 'c'];
    setItems(list);
    row('b').focus();
    render();

    // A scroll's render: same list, same row.
    const indexOf = vi.spyOn(list, 'indexOf');
    render();
    render();
    expect(indexOf).not.toHaveBeenCalled();
  });
});
