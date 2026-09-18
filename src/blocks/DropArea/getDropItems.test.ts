import { describe, expect, it, vi } from 'vitest';
import { getDropItems } from './getDropItems';

/**
 * `getDropItems` normalises what a drop event carries — plain files, directory trees behind the non-standard
 * `webkitGetAsEntry` API, and dragged links — into one flat list.
 *
 * The item shapes are built by hand: a real `DataTransfer` cannot be given entry APIs, and the directory-tree branch
 * only exists because browsers expose it on `DataTransferItem`. One cast at the call boundary keeps the stubs honest
 * about being partial.
 */

/** `webkitGetAsEntry` is omitted from the base so the stub can return partial entries rather than full FileSystemEntry. */
type StubItem = Omit<Partial<DataTransferItem>, 'webkitGetAsEntry'> & {
  webkitGetAsEntry?: () => unknown;
  getAsEntry?: () => unknown;
};

const drop = (items: StubItem[]) => getDropItems({ items } as unknown as DataTransfer);

const fileItem = (file: File, type = file.type): StubItem => ({
  kind: 'file',
  type,
  getAsFile: () => file,
});

const fileEntry = (file: File, fullPath: string) => ({
  isFile: true,
  isDirectory: false,
  fullPath,
  file: (cb: (f: File) => void) => cb(file),
});

const directoryEntry = (children: unknown[]) => ({
  isFile: false,
  isDirectory: true,
  createReader: () => ({
    readEntries: (cb: (entries: unknown[]) => void) => cb(children),
  }),
});

describe('getDropItems', () => {
  const png = () => new File(['x'], 'a.png', { type: 'image/png' });

  it('returns nothing for an empty transfer', async () => {
    expect(await drop([])).toEqual([]);
  });

  it('skips holes in the item list', async () => {
    expect(await drop([undefined as unknown as StubItem])).toEqual([]);
  });

  describe('plain files', () => {
    it('passes a dropped file through', async () => {
      const file = png();

      expect(await drop([fileItem(file)])).toEqual([{ type: 'file', file }]);
    });

    it('ignores an item whose file cannot be read', async () => {
      expect(await drop([{ kind: 'file', type: 'image/png', getAsFile: () => null }])).toEqual([]);
    });

    it('drops an item that reads as a directory', async () => {
      // A directory dragged into a browser without the entry API surfaces as a File that fails to read.
      const OriginalFileReader = window.FileReader;
      class FailingFileReader {
        public onerror: (() => void) | null = null;
        public onloadend: (() => void) | null = null;
        public onprogress: (() => void) | null = null;
        public abort() {}
        public readAsDataURL() {
          this.onerror?.();
        }
      }
      vi.stubGlobal('FileReader', FailingFileReader);
      try {
        expect(await drop([fileItem(png())])).toEqual([]);
      } finally {
        vi.stubGlobal('FileReader', OriginalFileReader);
      }
    });
  });

  describe('entries', () => {
    it('reads a single file entry and keeps its full path', async () => {
      const file = png();
      const items = await drop([
        { kind: 'file', type: 'image/png', webkitGetAsEntry: () => fileEntry(file, '/a.png') },
      ]);

      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({ type: 'file', fullPath: '/a.png' });
    });

    it('falls back to the item type when the entry file has none', async () => {
      // webkitGetAsEntry loses the mime type for some formats (HEIC), so the DataTransferItem type wins.
      const untyped = new File(['x'], 'a.heic', { type: '' });
      const items = await drop([
        { kind: 'file', type: 'image/heic', webkitGetAsEntry: () => fileEntry(untyped, '/a.heic') },
      ]);

      expect((items[0] as { file: File }).file.type).toBe('image/heic');
    });

    it('walks a directory tree', async () => {
      const nested = directoryEntry([fileEntry(png(), '/dir/sub/b.png')]);
      const tree = directoryEntry([fileEntry(png(), '/dir/a.png'), nested]);
      const items = await drop([{ kind: 'file', type: '', webkitGetAsEntry: () => tree }]);

      expect(items.map((item) => (item as { fullPath: string }).fullPath).sort()).toEqual([
        '/dir/a.png',
        '/dir/sub/b.png',
      ]);
    });

    it('uses getAsEntry when webkitGetAsEntry is absent', async () => {
      const items = await drop([{ kind: 'file', type: 'image/png', getAsEntry: () => fileEntry(png(), '/a.png') }]);

      expect(items).toHaveLength(1);
    });

    it('warns and yields nothing for an empty entry', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        expect(await drop([{ kind: 'file', type: '', webkitGetAsEntry: () => null }])).toEqual([]);
        // A null entry short-circuits before `readEntryContentAsync`, so nothing is logged for it.
        expect(warn).not.toHaveBeenCalled();
      } finally {
        warn.mockRestore();
      }
    });

    it('warns when a directory reader yields an empty entry', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const tree = directoryEntry([null]);
        expect(await drop([{ kind: 'file', type: '', webkitGetAsEntry: () => tree }])).toEqual([]);
        expect(warn).toHaveBeenCalledWith('Unexpectedly received empty content entry', { scope: 'drag-and-drop' });
      } finally {
        warn.mockRestore();
      }
    });
  });

  describe('dragged links', () => {
    const uriItem = (url: string, type = 'text/uri-list'): StubItem => ({
      kind: 'string',
      type,
      getAsString: (cb: (value: string) => void) => cb(url),
    });

    it('turns a uri-list item into a url', async () => {
      expect(await drop([uriItem('https://example.com/a.png')])).toEqual([
        { type: 'url', url: 'https://example.com/a.png' },
      ]);
    });

    it('accepts a uri-list with a charset suffix', async () => {
      expect(await drop([uriItem('https://example.com/a.png', 'text/uri-list;charset=utf-8')])).toHaveLength(1);
    });

    it('ignores other string items', async () => {
      expect(await drop([uriItem('just text', 'text/plain')])).toEqual([]);
    });
  });

  it('collects files and links dropped together', async () => {
    const items = await drop([
      fileItem(png()),
      {
        kind: 'string',
        type: 'text/uri-list',
        getAsString: (cb: (v: string) => void) => cb('https://example.com/b.png'),
      },
    ]);

    expect(items.map((item) => item.type).sort()).toEqual(['file', 'url']);
  });
});
