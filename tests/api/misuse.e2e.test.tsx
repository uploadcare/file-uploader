import { describe, expect, it, vi } from 'vitest';
import { IMAGE } from '~/tests/fixtures/files';
import { type EventRecorder, recordEvents } from '~/tests/utils/event-recorder';
import { renderSolution } from '~/tests/utils/render-solution';
import '~/types/jsx';

/**
 * The documented API described in `fern-docs` covers the happy path. This covers what happens when a caller passes an
 * id that does not exist, calls things out of order, or reaches for an option the docs mention but nothing tests.
 *
 * Where current behaviour is surprising it is marked `QUIRK(...)` and pinned as-is, not fixed.
 */

describe('unknown internal ids', () => {
  // Documented (api.mdx): `getOutputItem` throws for an id that is not in this uploader's list.
  it('getOutputItem throws rather than returning null', async () => {
    const { api } = await renderSolution();
    expect(() => api.getOutputItem('does-not-exist')).toThrow(/not found in the upload collection/);
  });

  // Documented (api.mdx): `removeFileByInternalId` throws for an unknown id — removing the same file twice hits it.
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

  it("getOutputItem does not resolve another uploader's entry", async () => {
    const first = await renderSolution();
    const entry = first.api.addFileFromObject(IMAGE.PIXEL, { fileName: 'from-first.jpg' });

    const second = await renderSolution();
    expect(() => second.api.getOutputItem(entry.internalId)).toThrow(/not found in the upload collection/);
    expect(first.api.getOutputItem(entry.internalId).name).toBe('from-first.jpg');
  });
});

/**
 * The end of a negative wait on events: opening the flow fires activity-change and a debounced modal-open, so once
 * modal-open lands, anything the call under test fired, debounced or not, has landed before it.
 */
const openFlowAsSentinel = async (api: Awaited<ReturnType<typeof renderSolution>>['api'], recorder: EventRecorder) => {
  api.initFlow();
  await recorder.waitFor('modal-open');
};

describe('no-op calls', () => {
  it('removeAllFiles on an empty collection does nothing', async () => {
    const { api, provider } = await renderSolution();
    const recorder = recordEvents(provider);

    expect(() => api.removeAllFiles()).not.toThrow();
    await openFlowAsSentinel(api, recorder);

    expect(recorder.types).toEqual(['activity-change', 'modal-open']);
  });

  it('uploadAll on an empty collection emits nothing', async () => {
    const { api, provider } = await renderSolution();
    const recorder = recordEvents(provider);

    api.uploadAll();
    await openFlowAsSentinel(api, recorder);

    expect(recorder.types).toEqual(['activity-change', 'modal-open']);
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
    // The sentinel: a handler still subscribed hears the same file-added the removed one would have.
    const sentinel = vi.fn();
    api.on('file-added', sentinel);

    api.addFileFromObject(IMAGE.PIXEL);
    await vi.waitFor(() => expect(sentinel).toHaveBeenCalledOnce());

    expect(handler).not.toHaveBeenCalled();
  });
});

describe('setCurrentActivity / setModalState misuse', () => {
  it('warns instead of throwing for an activity nothing registered', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { api } = await renderSolution();
    api.setCurrentActivity('no-such-activity' as 'start-from');

    await vi.waitFor(() => {
      expect(warn).toHaveBeenCalledWith(
        expect.stringMatching(/^\[uc]/),
        expect.stringContaining('not found in the context'),
      );
    });
  });

  // As in v1, which reports an activity when its block activates: the activity is set, but nothing in the ctx shows it.
  it('reports no activity-change for an activity nothing shows', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // No external source in the list, so the external-source plugin and its block are never loaded.
    const { api, provider } = await renderSolution('regular', { sourceList: 'local, url, camera' });
    const recorder = recordEvents(provider);
    api.setCurrentActivity('external', { externalSourceType: 'gdrive' });

    // The warning is the last thing the call does.
    await vi.waitFor(() => {
      expect(warn).toHaveBeenCalledWith(
        expect.stringMatching(/^\[uc]/),
        expect.stringContaining('"external" not found in the context'),
      );
    });
    expect(recorder.detailsOf('activity-change')).toEqual([]);
    expect(api.getCurrentActivity()).toBe('external');
  });

  it('warns when asked to open the modal with no current activity', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { api } = await renderSolution();
    api.setModalState(true);

    await vi.waitFor(() => {
      expect(warn).toHaveBeenCalledWith(
        expect.stringMatching(/^\[uc]/),
        expect.stringContaining("Can't open modal without current activity"),
      );
    });
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

    // The trailing `change` after common-upload-success is the upload's last event.
    await recorder.waitForAfter('change', 'common-upload-success');

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
  // Like `addFileFromCdnUrl`, a value that is not exactly a file uuid is rejected up front and nothing is added.
  it('throws for a value that is not a uuid', async () => {
    const { api } = await renderSolution();

    for (const value of ['not-a-uuid', '', 'f4dc9ebc-ed6d-4b4d-83d1-863bf1e4bb7f/-/resize/100x/']) {
      expect(() => api.addFileFromUuid(value)).toThrow('Invalid UUID');
    }
    expect(api.getOutputCollectionState().totalCount).toBe(0);
  });

  it('adds a valid uuid', async () => {
    const { api } = await renderSolution();
    const entry = api.addFileFromUuid('f4dc9ebc-ed6d-4b4d-83d1-863bf1e4bb7f');

    expect(entry.uuid).toBe('f4dc9ebc-ed6d-4b4d-83d1-863bf1e4bb7f');
  });
});
