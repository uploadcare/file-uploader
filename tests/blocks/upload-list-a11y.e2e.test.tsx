import { describe, expect, it, onTestFinished } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import type { Config } from '@/index.js';
import { expectNoA11yViolations } from '../utils/a11y';
import { type RenderedUploader, renderSolution, within } from '../utils/render-solution';

type Row = HTMLElement & { uid: string };

const addFiles = (api: RenderedUploader['api'], count: number) => {
  for (let i = 0; i < count; i++) {
    api.addFileFromObject(new File(['x'], `f${String(i).padStart(3, '0')}.txt`, { type: 'text/plain' }));
  }
};

/** The modal's upload list with `count` files, once it has rendered (and windowed, for a long list). */
const openList = async (count: number, configProps: Partial<Config> = {}) => {
  const uploader = await renderSolution('regular', { confirmUpload: true, multipleMax: 1000, ...configProps });
  addFiles(uploader.api, count);
  uploader.api.setCurrentActivity('upload-list');
  uploader.api.setModalState(true);
  const list = within(uploader.root).getByTestId('uc-upload-list');
  await expect.element(list).toBeVisible();
  await expect.poll(() => uploader.root.querySelectorAll('uc-file-item').length).toBeGreaterThan(0);
  if (count > 100) {
    await expect.poll(() => uploader.root.querySelector('.uc-list-spacer')).not.toBeNull();
  }
  const { root, api } = uploader;
  const ids = () => api.getOutputCollectionState().allEntries.map((entry) => entry.internalId);
  const rows = () => [...root.querySelectorAll<Row>('uc-file-item')];
  const rowAt = (index: number) => rows().find((row) => row.uid === ids()[index]);
  const files = root.querySelector<HTMLElement>('.uc-files')!;
  // A row renders empty until it has scrolled into view: its buttons come with that render.
  const buttonOf = async (index: number) => {
    await expect.poll(() => rowAt(index)?.querySelector('button')).toBeTruthy();
    return rowAt(index)!.querySelector('button')!;
  };
  return { ...uploader, list: list.element() as HTMLElement, files, ids, rows, rowAt, buttonOf };
};

/** The row holding focus, and its index in the whole list (-1 when focus is not in a row). */
const focusedIndex = (ids: () => string[]) => {
  const row = document.activeElement?.closest<Row>('uc-file-item');
  return row ? ids().indexOf(row.uid) : -1;
};

/** Focus is on a row itself (not a button inside it), and that row is the one at `index`. */
const focusIsOnRow = (ids: () => string[]) => {
  const active = document.activeElement;
  return active?.localName === 'uc-file-item' ? ids().indexOf((active as Row).uid) : -1;
};

/** Tab into the list from the header's Close button, as a keyboard user enters it. */
const tabIntoList = async (root: HTMLElement) => {
  root.querySelector<HTMLElement>('uc-upload-list .uc-close-btn')!.focus();
  await userEvent.tab();
};

const press = async (key: string, times = 1) => {
  for (let i = 0; i < times; i++) {
    await userEvent.keyboard(`{${key}}`);
  }
};

describe('uc-upload-list accessibility (axe)', () => {
  it('reports nothing for a short list of idle and failed files', async () => {
    const { root, api } = await renderSolution('regular', { confirmUpload: true, multipleMax: 10, imgOnly: true });
    api.addFileFromObject(new File(['x'], 'photo.png', { type: 'image/png' }));
    api.addFileFromObject(new File(['x'], 'notes.txt', { type: 'text/plain' }));
    api.setCurrentActivity('upload-list');
    api.setModalState(true);
    const list = within(root).getByTestId('uc-upload-list');
    await expect.element(list).toBeVisible();
    await expect
      .poll(() => api.getOutputCollectionState().allEntries.map((entry) => entry.status))
      .toEqual(['idle', 'failed']);
    await expect.poll(() => root.querySelectorAll('uc-file-item .uc-file-name').length).toBe(2);

    // The failed row's error text fails color-contrast: #e81314 on #f5f5f5 at 11px measures 4.24:1, under the 4.5:1
    // AA needs. The owner decided to keep the theme colour as is, so that one element is left out of that one rule.
    const errorText = root.querySelector('[data-failed] .uc-file-error')!;
    await expectNoA11yViolations(list.element(), { disable: ['color-contrast'] });
    await expectNoA11yViolations({ include: [list.element()], exclude: [errorText] }, { only: ['color-contrast'] });
  });

  it('reports nothing for a 300-file list that scrolls', async () => {
    const { list } = await openList(300);

    await expectNoA11yViolations(list);
  });
});

describe('uc-upload-list keyboard access', () => {
  it('makes the list one Tab stop whose rows carry their place in the whole list', async () => {
    const { root, files, ids, rowAt } = await openList(300);
    expect(files.getAttribute('role')).toBe('list');

    files.scrollTop = files.scrollHeight * 0.66;
    await expect.poll(() => rowAt(200)).toBeDefined();
    const deep = rowAt(200)!;
    expect(deep.getAttribute('role')).toBe('listitem');
    expect(deep.getAttribute('aria-setsize')).toBe('300');
    expect(deep.getAttribute('aria-posinset')).toBe('201');

    // Exactly one row is in the tab order: the current one, the first until the user moves.
    await tabIntoList(root);
    expect(focusIsOnRow(ids)).toBe(0);
    const tabbable = [...root.querySelectorAll('uc-file-item')].filter((row) => row.getAttribute('tabindex') === '0');
    expect(tabbable).toHaveLength(1);
  });

  it('reaches the last of 300 rows with End, and the first with Home', async () => {
    const { root, ids } = await openList(300);
    await tabIntoList(root);

    await press('End');
    await expect.poll(() => focusIsOnRow(ids)).toBe(299);

    await press('Home');
    await expect.poll(() => focusIsOnRow(ids)).toBe(0);
  });

  it('names a row End scrolled in by the time it takes focus', async () => {
    const { root, ids } = await openList(300);
    // What a screen reader announces is read when focus lands, not once the row renders.
    const namesOnFocus: (string | null)[] = [];
    const record = (event: FocusEvent) =>
      event.target instanceof Element && namesOnFocus.push(event.target.getAttribute('aria-label'));
    document.addEventListener('focusin', record);
    onTestFinished(() => document.removeEventListener('focusin', record));
    await tabIntoList(root);

    await press('End');
    await expect.poll(() => focusIsOnRow(ids)).toBe(299);
    expect(namesOnFocus.at(-1)).toMatch(/^File f299\.txt in status /);
  });

  it('keeps moving down with ArrowDown past the rendered window, and by a page with PageDown', async () => {
    const { root, ids, rows } = await openList(300);
    const rendered = rows().length;
    await tabIntoList(root);

    await press('ArrowDown', rendered + 5);
    await expect.poll(() => focusIsOnRow(ids)).toBe(rendered + 5);

    await press('ArrowUp');
    await expect.poll(() => focusIsOnRow(ids)).toBe(rendered + 4);

    await press('PageDown');
    await expect.poll(() => focusIsOnRow(ids)).toBeGreaterThan(rendered + 5);
  });

  it('goes from the current row through its own buttons to the footer, and back with Shift+Tab', async () => {
    const { root, ids, buttonOf } = await openList(300);
    await tabIntoList(root);
    await press('ArrowDown', 3);
    await expect.poll(() => focusIsOnRow(ids)).toBe(3);

    const remove = await buttonOf(3);
    // The row made current re-renders its buttons into the tab order.
    await expect.poll(() => remove.tabIndex).toBe(0);
    await userEvent.tab();
    expect(document.activeElement).toBe(remove);
    await userEvent.tab();
    expect(root.querySelector('.uc-toolbar')!.contains(document.activeElement)).toBe(true);

    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(remove);
    await userEvent.tab({ shift: true });
    expect(focusIsOnRow(ids)).toBe(3);
  });

  it("leaves focus where the page's own key handler moved it", async () => {
    // An inline dialog leaves the page focusable.
    const { root, ids, rowAt } = await openList(300, { modalPresentation: 'inline' });
    const search = document.createElement('input');
    document.body.append(search);
    const toSearch = (event: KeyboardEvent) => event.key === 'ArrowDown' && search.focus();
    document.addEventListener('keydown', toSearch);
    onTestFinished(() => {
      document.removeEventListener('keydown', toSearch);
      search.remove();
    });
    await tabIntoList(root);
    await expect.poll(() => focusIsOnRow(ids)).toBe(0);

    // Dispatched from script: a key from the keyboard runs microtasks between listeners, so the list's own focus move
    // lands before the page's listener runs. Dispatched synchronously, the page's listener runs first.
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    // The list took the key: the next row is current once the update that would focus it has landed.
    await expect.poll(() => rowAt(1)?.getAttribute('tabindex')).toBe('0');
    expect(document.activeElement).toBe(search);
  });

  it('follows the reading direction with ArrowLeft/Right in a right-to-left grid', async () => {
    await page.viewport(1280, 900);
    onTestFinished(() => page.viewport(414, 896));
    document.documentElement.dir = 'rtl';
    onTestFinished(() => document.documentElement.removeAttribute('dir'));
    const { root, ids } = await openList(30, { filesViewMode: 'grid' });
    expect(getComputedStyle(root.querySelector('.uc-files')!).direction).toBe('rtl');
    await tabIntoList(root);

    // The next file sits to the left.
    await press('ArrowLeft');
    await expect.poll(() => focusIsOnRow(ids)).toBe(1);
    await press('ArrowRight');
    await expect.poll(() => focusIsOnRow(ids)).toBe(0);
  });

  it('moves by one cell with ArrowLeft/Right and by one visual row with ArrowUp/Down in grid view', async () => {
    // Wide enough for the theme's three columns (the default 414px viewport has one).
    await page.viewport(1280, 900);
    onTestFinished(() => page.viewport(414, 896));
    const { root, ids } = await openList(300, { filesViewMode: 'grid' });
    const columns = Number.parseInt(
      getComputedStyle(root.querySelector('uc-upload-list')!).getPropertyValue('--uc-grid-col'),
      10,
    );
    expect(columns).toBeGreaterThan(1);
    await tabIntoList(root);

    await press('ArrowRight');
    await expect.poll(() => focusIsOnRow(ids)).toBe(1);
    await press('ArrowDown');
    await expect.poll(() => focusIsOnRow(ids)).toBe(1 + columns);
    await press('ArrowLeft');
    await expect.poll(() => focusIsOnRow(ids)).toBe(columns);
    await press('ArrowUp');
    await expect.poll(() => focusIsOnRow(ids)).toBe(0);

    await press('End');
    await expect.poll(() => focusIsOnRow(ids)).toBe(299);
  });

  it('moves by the rows that fit the viewport, gaps included, with PageDown in grid view', async () => {
    await page.viewport(1280, 900);
    onTestFinished(() => page.viewport(414, 896));
    // A gap wide enough that counting tiles alone would overshoot the page. Set before the list measures its rows.
    const style = document.createElement('style');
    style.textContent = '.uc-files { --uc-grid-gap: 60px; }';
    document.head.append(style);
    onTestFinished(() => style.remove());
    const { root, ids, files, rowAt } = await openList(300, { filesViewMode: 'grid' });
    const columns = Number.parseInt(
      getComputedStyle(root.querySelector('uc-upload-list')!).getPropertyValue('--uc-grid-col'),
      10,
    );
    const pitch = () => rowAt(columns)!.offsetTop - rowAt(0)!.offsetTop;
    await expect.poll(() => pitch() - rowAt(0)!.offsetHeight).toBe(60);
    const pageRows = Math.floor(files.clientHeight / pitch());
    expect(pageRows).toBeLessThan(Math.floor(files.clientHeight / rowAt(0)!.offsetHeight));
    await tabIntoList(root);

    await press('PageDown');
    await expect.poll(() => focusIsOnRow(ids)).toBe(pageRows * columns);
  });
});

describe('uc-upload-list focus retention', () => {
  it('keeps focus on its row when the list scrolls far away', async () => {
    const { files, ids, rowAt, buttonOf } = await openList(300);
    (await buttonOf(2)).focus();
    expect(focusedIndex(ids)).toBe(2);

    files.scrollTop = files.scrollHeight / 2;
    // The window has moved to the middle of the list.
    await expect.poll(() => rowAt(150)).toBeDefined();

    expect(document.activeElement).not.toBe(document.body);
    expect(focusedIndex(ids)).toBe(2);
    expect(document.activeElement!.isConnected).toBe(true);
  });

  it('moves focus to the next row when the focused row is removed with its button', async () => {
    const { ids, buttonOf } = await openList(300);
    const next = ids()[6];
    (await buttonOf(5)).focus();

    await press('Enter');
    await expect.poll(() => ids()).toHaveLength(299);
    await expect.poll(() => (document.activeElement as Row | null)?.uid).toBe(next);
    expect(document.activeElement?.localName).toBe('uc-file-item');
  });

  it('moves focus to the previous row when the focused last row is removed by the API', async () => {
    const { api, root, ids } = await openList(5);
    await tabIntoList(root);
    await press('End');
    await expect.poll(() => focusIsOnRow(ids)).toBe(4);
    const [previous, last] = ids().slice(3);

    api.removeFileByInternalId(last!);
    await expect.poll(() => (document.activeElement as Row | null)?.uid).toBe(previous);
  });

  it('hands focus to Add more when every file is removed from a list that stays open', async () => {
    const { api, root, ids } = await openList(3, { showEmptyList: true });
    await tabIntoList(root);
    await expect.poll(() => focusIsOnRow(ids)).toBe(0);

    api.removeAllFiles();
    const addMore = root.querySelector('.uc-toolbar .uc-add-more-btn');
    await expect.poll(() => document.activeElement).toBe(addMore);
  });

  it('hands focus to Add more once it is enabled again, when removing every file frees the limit', async () => {
    const { api, root, ids } = await openList(3, { showEmptyList: true, multipleMax: 3 });
    const addMore = root.querySelector<HTMLButtonElement>('.uc-toolbar .uc-add-more-btn')!;
    await expect.poll(() => addMore.disabled).toBe(true);
    await tabIntoList(root);
    await expect.poll(() => focusIsOnRow(ids)).toBe(0);

    api.removeAllFiles();
    await expect.poll(() => document.activeElement).toBe(addMore);
    expect(addMore.disabled).toBe(false);
  });

  // Remove the only file with its own button, as a keyboard user does: from the row, Tab to Remove, Enter.
  const removeOnlyFileByKeyboard = async (root: HTMLElement) => {
    await expect.poll(() => root.querySelector('uc-file-item button')).not.toBeNull();
    const row = root.querySelector<HTMLElement>('uc-file-item')!;
    row.focus();
    await userEvent.tab();
    expect(document.activeElement?.closest('uc-file-item')).toBe(row);
    await press('Enter');
    // Settled: the emptied list has closed.
    await expect.poll(() => root.querySelector('uc-upload-list')?.hasAttribute('active')).toBe(false);
  };

  // Settled on a control someone can use: visible, enabled, in the uploader.
  const focusIsUsableIn = (root: HTMLElement) => {
    const active = document.activeElement;
    return !!active && root.contains(active) && active.checkVisibility() && !active.matches(':disabled');
  };

  it('keeps focus on a usable control when removing the last file closes the list back to the source picker', async () => {
    const { api, root } = await renderSolution('regular', { confirmUpload: true, multipleMax: 10 });
    await within(root).getByRole('button', { name: 'Upload files' }).click();
    api.addFileFromObject(new File(['x'], 'a.txt', { type: 'text/plain' }));
    api.setCurrentActivity('upload-list');

    await removeOnlyFileByKeyboard(root);
    await expect.poll(() => focusIsUsableIn(root)).toBe(true);
  });

  it('returns focus to what opened the modal when removing the last file closes it', async () => {
    const opener = document.createElement('button');
    opener.textContent = 'Open the uploader';
    document.body.append(opener);
    onTestFinished(() => opener.remove());
    const { api, root } = await renderSolution('regular', { confirmUpload: true, multipleMax: 10 });
    api.addFileFromObject(new File(['x'], 'a.txt', { type: 'text/plain' }));
    opener.focus();
    api.setCurrentActivity('upload-list');
    api.setModalState(true);

    await removeOnlyFileByKeyboard(root);
    await expect.poll(() => root.querySelector('dialog[open]')).toBeNull();
    await expect.poll(() => document.activeElement).toBe(opener);
  });

  it("hands focus to the minimal uploader's trigger when removing the last file in grid view closes the list", async () => {
    const { api, root } = await renderSolution('minimal', { filesViewMode: 'grid', multipleMax: 10 });
    api.addFileFromObject(new File(['x'], 'a.txt', { type: 'text/plain' }));

    await removeOnlyFileByKeyboard(root);
    const trigger = root.querySelector('uc-start-from uc-drop-area');
    await expect.poll(() => document.activeElement).toBe(trigger);
  });

  it('leaves focus alone when a row is removed while focus is outside the list', async () => {
    const { api, root, ids } = await openList(5);
    const clear = root.querySelector<HTMLElement>('.uc-toolbar .uc-cancel-btn')!;
    clear.focus();

    api.removeFileByInternalId(ids()[0]!);
    await expect.poll(() => ids()).toHaveLength(4);
    expect(document.activeElement).toBe(clear);
  });
});
