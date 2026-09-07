import { beforeAll, describe, expect, it, vi } from 'vitest';
import { delay } from '@/utils/delay';
import { IMAGE } from './fixtures/files';
import { recordEvents } from './utils/event-recorder';
import { renderSolution } from './utils/render-solution';
import '../types/jsx';

/**
 * The documented API described in `fern-docs` covers the happy path. This covers what happens when a caller passes an
 * id that does not exist, calls things out of order, or reaches for an option the docs mention but nothing tests.
 *
 * Where current behaviour is surprising it is marked `QUIRK(...)` and pinned as-is, not fixed.
 */

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

describe('unknown internal ids', () => {
  // QUIRK(api): api.mdx documents `getOutputItem(internalId: string) => OutputFileEntry` with no mention that it can
  // throw, so a caller reading the docs would expect null/undefined for a stale id. Pinned as current behaviour,
  // not endorsed (UploaderPublicApi.ts:295).
  it('getOutputItem throws rather than returning null', async () => {
    const { api } = await renderSolution();
    expect(() => api.getOutputItem('does-not-exist')).toThrow(/not found in the upload collection/);
  });

  // QUIRK(api): same shape — documented as `=> void`, throws on an id it does not know
  // (UploaderPublicApi.ts:193). Removing the same file twice is the realistic way to hit it.
  it('removeFileByInternalId throws for an unknown id', async () => {
    const { api } = await renderSolution();
    expect(() => api.removeFileByInternalId('does-not-exist')).toThrow(/not found/);
  });

  it('removeFileByInternalId throws the second time the same file is removed', async () => {
    const { api } = await renderSolution();
    const entry = api.addFileFromObject(IMAGE.PIXEL);

    api.removeFileByInternalId(entry.internalId);
    expect(() => api.removeFileByInternalId(entry.internalId)).toThrow(/not found/);
  });

  // QUIRK(api): entry stores live in a single module-level Map keyed by internal id (PubSubCompat.ts:8), not per
  // ctx-name, so one uploader will happily return another uploader's entry. Ids are random, so this is not reachable
  // by accident — but the isolation the multi-ctx model implies is not there. Pinned, not endorsed.
  it('getOutputItem reads across ctx boundaries', async () => {
    const first = await renderSolution();
    const entry = first.api.addFileFromObject(IMAGE.PIXEL, { fileName: 'from-first.jpg' });

    const second = await renderSolution();
    expect(second.api.getOutputItem(entry.internalId).name).toBe('from-first.jpg');
  });
});

describe('calls that should be no-ops', () => {
  it('removeAllFiles on an empty collection does nothing', async () => {
    const { api, provider } = await renderSolution();
    const recorder = recordEvents(provider);

    expect(() => api.removeAllFiles()).not.toThrow();
    await delay(50);
    expect(recorder.types).toEqual([]);
  });

  it('uploadAll on an empty collection emits nothing', async () => {
    const { api, provider } = await renderSolution();
    const recorder = recordEvents(provider);

    api.uploadAll();
    await delay(50);
    expect(recorder.detailsOf('common-upload-start')).toEqual([]);
  });

  it('doneFlow before initFlow does not throw', async () => {
    const { api } = await renderSolution();
    expect(() => api.doneFlow()).not.toThrow();
  });

  it('historyBack with no history does not throw', async () => {
    const { api } = await renderSolution();
    expect(() => api.historyBack()).not.toThrow();
    expect(api.getCurrentActivity()).toBe(null);
  });

  it('unsubscribing twice is safe', async () => {
    const { api } = await renderSolution();
    const handler = vi.fn();
    const unsubscribe = api.on('file-added', handler);

    unsubscribe();
    expect(() => unsubscribe()).not.toThrow();

    api.addFileFromObject(IMAGE.PIXEL);
    await delay(50);
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('setCurrentActivity / setModalState misuse', () => {
  it('warns instead of throwing for an activity nothing registered', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { api } = await renderSolution();
      api.setCurrentActivity('no-such-activity' as 'start-from');

      await vi.waitFor(() => {
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('not found in the context'));
      });
    } finally {
      warn.mockRestore();
    }
  });

  it('warns when asked to open the modal with no current activity', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { api } = await renderSolution();
      api.setModalState(true);

      await vi.waitFor(() => {
        expect(warn).toHaveBeenCalledWith(expect.stringContaining("Can't open modal without current activity"));
      });
    } finally {
      warn.mockRestore();
    }
  });
});

describe('addFileFromCdnUrl', () => {
  const UUID = 'c2b0b7ee-9ba4-4a1f-8b4b-4f0d1b6f0d1b';

  it('keeps the operations from a CDN URL that already has them', async () => {
    const { api } = await renderSolution();
    const entry = api.addFileFromCdnUrl(`https://ucarecdn.com/${UUID}/-/resize/100x/-/grayscale/`);

    expect(entry.uuid).toBe(UUID);
    expect(entry.cdnUrlModifiers).toBe('-/resize/100x/-/grayscale/');
  });

  it('throws for a URL that is not an Uploadcare CDN URL', async () => {
    const { api } = await renderSolution();
    expect(() => api.addFileFromCdnUrl('https://example.com/image.jpg')).toThrow('Invalid CDN URL');
  });

  it('throws for a group URL', async () => {
    const { api } = await renderSolution();
    // Groups are a documented Uploadcare URL kind, but the uploader only handles single files.
    expect(() => api.addFileFromCdnUrl(`https://ucarecdn.com/${UUID}~2/`)).toThrow('Invalid CDN URL');
  });
});

describe('addFileFromObject', () => {
  it('takes a name for a Blob that has none', async () => {
    const { api } = await renderSolution();
    const blob = new Blob(['hello'], { type: 'text/plain' });
    const entry = api.addFileFromObject(blob as File, { fileName: 'named.txt' });

    expect(entry.name).toBe('named.txt');
    expect(entry.size).toBe(5);
  });

  it('accepts an empty file', async () => {
    const { api } = await renderSolution();
    const entry = api.addFileFromObject(new File([], 'empty.jpg', { type: 'image/jpeg' }));

    expect(entry.size).toBe(0);
    expect(entry.name).toBe('empty.jpg');
  });

  it('keeps a non-ASCII file name intact', async () => {
    const { api } = await renderSolution();
    const name = 'снимок-🚀-2026.jpg';
    const entry = api.addFileFromObject(new File(['x'], name, { type: 'image/jpeg' }));

    expect(entry.name).toBe(name);
  });
});

describe('silent: true', () => {
  it('suppresses the four documented per-file events but not the collection ones', async () => {
    const { api, provider } = await renderSolution('regular', { confirmUpload: false });
    const recorder = recordEvents(provider);

    api.addFileFromObject(IMAGE.PIXEL, { silent: true });
    api.uploadAll();

    await recorder.waitFor('common-upload-success');
    await delay(500);

    // api.mdx: "events file-added, file-upload-start, file-upload-progress, file-upload-success won't be triggered".
    expect(recorder.detailsOf('file-added')).toEqual([]);
    expect(recorder.detailsOf('file-upload-start')).toEqual([]);
    expect(recorder.detailsOf('file-upload-progress')).toEqual([]);
    expect(recorder.detailsOf('file-upload-success')).toEqual([]);

    // The collection-level events are not silenced — the docs list only the four above, and a silent file still
    // counts towards the collection, so `change` and the common-* events fire as usual.
    expect(recorder.detailsOf('common-upload-success')).toHaveLength(1);
    expect(recorder.detailsOf('change').length).toBeGreaterThan(0);
  });

  it('still returns the entry to the caller', async () => {
    const { api } = await renderSolution();
    const entry = api.addFileFromObject(IMAGE.PIXEL, { silent: true, fileName: 'quiet.jpg' });

    expect(entry.name).toBe('quiet.jpg');
    expect(api.getOutputItem(entry.internalId).name).toBe('quiet.jpg');
  });
});

describe('addFileFromUuid', () => {
  // QUIRK(api): nothing validates the uuid at add time — unlike addFileFromCdnUrl, which throws on input it cannot
  // parse (UploaderPublicApi.ts:85). A malformed uuid is accepted here and only surfaces later, when the entry is
  // resolved. Pinned as current behaviour, not endorsed.
  it('accepts a malformed uuid without complaint', async () => {
    const { api } = await renderSolution();
    const entry = api.addFileFromUuid('not-a-uuid');

    expect(entry.uuid).toBe('not-a-uuid');
    expect(entry.status).toBe('idle');
  });
});
