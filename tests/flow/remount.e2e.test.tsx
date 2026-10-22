import type { FileFromOptions, UploadcareFile } from '@uploadcare/upload-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { delay } from '@/utils/delay';
import { clearSent, sent, waitForType } from '~/tests/api/telemetry/sink';
import { IMAGE } from '~/tests/fixtures/files';
import { isLive } from '~/tests/utils/emulator.browser';
import { recordEvents } from '~/tests/utils/event-recorder';
import {
  expectActivity,
  type RenderedUploader,
  renderSolution,
  type Solution,
  within,
} from '~/tests/utils/render-solution';
import { getCtxName } from '~/tests/utils/test-renderer';
import '~/types/jsx';

/** Longer than the 300ms output flush, so trailing telemetry has been queued and sent. */
const SETTLE_MS = 1000;

/**
 * Re-mounting: sortable lists, framework re-parenting and SPA routers move the uploader's elements around. A move that
 * completes within one task keeps the ctx (its teardown is deferred by `setTimeout(0)` in
 * `ChildBlock._teardownCtxIfUnreferenced`); a move with a macrotask gap destroys it and a fresh one starts.
 *
 * `uploadFile` is stubbed so upload timing is in the test's hands and nothing reaches the network.
 */

const uploadFile = vi.hoisted(() => vi.fn());

vi.mock('@uploadcare/upload-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@uploadcare/upload-client')>();
  return { ...actual, uploadFile };
});

const UPLOADED = {
  uuid: '00000000-0000-4000-8000-000000000000',
  name: 'pixel.jpg',
  originalFilename: 'pixel.jpg',
  size: 1,
  isImage: true,
  isStored: true,
  mimeType: 'image/jpeg',
  cdnUrl: 'https://ucarecdn.com/00000000-0000-4000-8000-000000000000/',
  cdnUrlModifiers: '',
  imageInfo: null,
  videoInfo: null,
  contentInfo: null,
  metadata: {},
  s3Bucket: null,
  s3Url: null,
} as unknown as UploadcareFile;

/** Every uncaught error or rejection in the page during a test. Asserted empty after each one. */
const unhandled: unknown[] = [];
const onError = (event: ErrorEvent) => unhandled.push(event.error ?? event.message);
const onRejection = (event: PromiseRejectionEvent) => unhandled.push(event.reason);

beforeEach(() => {
  uploadFile.mockReset();
  uploadFile.mockResolvedValue(UPLOADED);
  unhandled.length = 0;
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
});

afterEach(() => {
  window.removeEventListener('error', onError);
  window.removeEventListener('unhandledrejection', onRejection);
  expect(unhandled).toEqual([]);
});

/** An empty element in the document to move things into, cleaned up with the rest of the render. */
const newParent = (tag: 'div' | 'section' = 'div'): HTMLElement => {
  const id = getCtxName();
  page.render(tag === 'div' ? <div id={id}></div> : <section id={id}></section>);
  return document.getElementById(id) as HTMLElement;
};

/** Every element of the composition `renderSolution` built, in DOM order. */
const composition = ({ root }: RenderedUploader): HTMLElement[] =>
  Array.from((root.parentElement as HTMLElement).children) as HTMLElement[];

/** Moves `elements` into `target` within the current task, the way a DOM move by a framework does. */
const moveNow = (elements: HTMLElement[], target: HTMLElement) => target.append(...elements);

/** Removes `elements`, lets the deferred ctx teardown run, then puts them into `target`. */
const moveDeferred = async (elements: HTMLElement[], target: HTMLElement) => {
  for (const element of elements) {
    element.remove();
  }
  // The macrotask gap is the subject: it lets the `setTimeout(0)` teardown run.
  await delay(50);
  target.append(...elements);
};

/** Waits for the uploader to settle after a move; a teardown, had one been scheduled, lands in a `setTimeout(0)`. */
const settle = () => delay(50);

const SOLUTIONS: Solution[] = ['regular', 'inline', 'minimal'];

describe.each(SOLUTIONS)('%s: synchronous move of the whole composition', (solution) => {
  it('keeps files, activity and config, and the same api', async () => {
    const uploader = await renderSolution(solution, { multipleMax: 3 });
    const { api, provider, config, root } = uploader;
    api.addFileFromObject(IMAGE.PIXEL);
    api.setCurrentActivity('upload-list');
    if (solution !== 'inline') api.setModalState(true);
    await expectActivity(root, 'upload-list');

    moveNow(composition(uploader), newParent());
    await settle();

    expect(provider.getAPI()).toBe(api);
    expect(api.getOutputCollectionState().totalCount).toBe(1);
    expect(api.getCurrentActivity()).toBe('upload-list');
    await expectActivity(root, 'upload-list');
    expect(config.multipleMax).toBe(3);
    await expect.element(within(root).getByText('pixel.jpg')).toBeVisible();
  });

  it('dispatches each event once on the provider after the move', async () => {
    const uploader = await renderSolution(solution);
    moveNow(composition(uploader), newParent());
    await settle();
    const recorder = recordEvents(uploader.provider);

    uploader.api.addFileFromObject(IMAGE.PIXEL);
    uploader.api.uploadAll();

    await recorder.waitFor('common-upload-success');
    // Negative wait: a duplicate listener would fire in the same flush.
    await delay(100);
    expect(recorder.detailsOf('file-added')).toHaveLength(1);
    expect(recorder.detailsOf('file-upload-success')).toHaveLength(1);
    expect(recorder.detailsOf('common-upload-success')).toHaveLength(1);
    expect(uploadFile).toHaveBeenCalledOnce();
  });
});

describe.each(SOLUTIONS)('%s: moving only the solution element', (solution) => {
  it('keeps state and the provider keeps receiving events once', async () => {
    const { api, provider, root } = await renderSolution(solution);
    api.addFileFromObject(IMAGE.PIXEL);

    newParent().append(root);
    await settle();
    const recorder = recordEvents(provider);

    expect(provider.getAPI()).toBe(api);
    expect(api.getOutputCollectionState().totalCount).toBe(1);
    api.addFileFromObject(IMAGE.PIXEL, { fileName: 'second.jpg' });

    await recorder.waitFor('file-added');
    await delay(100);
    expect(recorder.detailsOf('file-added')).toHaveLength(1);
    expect(api.getOutputCollectionState().totalCount).toBe(2);
  });
});

describe('regular: reordering two uploaders like a sortable list', () => {
  it('keeps each uploader its own state with no cross-talk', async () => {
    const first = await renderSolution('regular', { multipleMax: 2 });
    const second = await renderSolution('regular', { multipleMax: 5 });
    const list = newParent('section');
    const itemOf = (uploader: RenderedUploader) => uploader.root.parentElement as HTMLElement;
    list.append(itemOf(first), itemOf(second));

    first.api.addFileFromObject(IMAGE.PIXEL, { fileName: 'first.jpg' });
    second.api.addFileFromObject(IMAGE.PIXEL, { fileName: 'second-a.jpg' });
    second.api.addFileFromObject(IMAGE.PIXEL, { fileName: 'second-b.jpg' });

    // Swap, then swap back, then swap again — each an `insertBefore` within one task.
    for (let i = 0; i < 3; i++) {
      list.insertBefore(list.lastElementChild as HTMLElement, list.firstElementChild);
    }
    await settle();
    expect(list.firstElementChild).toBe(itemOf(second));

    const firstEvents = recordEvents(first.provider);
    const secondEvents = recordEvents(second.provider);
    first.api.addFileFromObject(IMAGE.PIXEL, { fileName: 'first-b.jpg' });
    await firstEvents.waitFor('file-added');
    await delay(100);

    expect(first.api.getOutputCollectionState().allEntries.map((entry) => entry.name)).toEqual([
      'first.jpg',
      'first-b.jpg',
    ]);
    expect(second.api.getOutputCollectionState().allEntries.map((entry) => entry.name)).toEqual([
      'second-a.jpg',
      'second-b.jpg',
    ]);
    expect(firstEvents.detailsOf('file-added')).toHaveLength(1);
    expect(secondEvents.events).toEqual([]);
    expect(first.config.multipleMax).toBe(2);
    expect(second.config.multipleMax).toBe(5);
  });
});

/** A stubbed upload that stays in flight until the test settles it. */
const deferredUpload = () => {
  let resolve: (file: UploadcareFile) => void = () => {};
  uploadFile.mockImplementation(
    () =>
      new Promise<UploadcareFile>((done) => {
        resolve = done;
      }),
  );
  return {
    finish: () => resolve(UPLOADED),
    options: () => uploadFile.mock.calls[0][1] as FileFromOptions,
  };
};

describe.each(SOLUTIONS)('%s: moving mid-upload', (solution) => {
  it('completes the upload and fires its events once', async () => {
    const uploader = await renderSolution(solution);
    const { api, provider } = uploader;
    const upload = deferredUpload();
    const recorder = recordEvents(provider);
    const entry = api.addFileFromObject(IMAGE.PIXEL);
    api.uploadAll();
    await vi.waitFor(() => expect(uploadFile).toHaveBeenCalledOnce());

    moveNow(composition(uploader), newParent());
    await settle();
    expect(upload.options().signal?.aborted).toBe(false);
    upload.options().onProgress?.({ isComputable: true, value: 0.5 });
    await vi.waitFor(() => expect(recorder.detailsOf('file-upload-progress')).toHaveLength(1));
    upload.finish();

    await recorder.waitFor('file-upload-success');
    await recorder.waitFor('common-upload-success');
    await delay(100);
    expect(api.getOutputItem(entry.internalId)?.uuid).toBe(UPLOADED.uuid);
    expect(api.getOutputItem(entry.internalId)?.status).toBe('success');
    expect(recorder.detailsOf('file-upload-start')).toHaveLength(1);
    expect(recorder.detailsOf('file-upload-success')).toHaveLength(1);
    expect(recorder.detailsOf('common-upload-success')).toHaveLength(1);
    expect(recorder.detailsOf('file-upload-progress')).toHaveLength(1);
    expect(uploadFile).toHaveBeenCalledOnce();
  });
});

describe('regular: repeated rapid moves', () => {
  it('survives ten moves in one task with events firing once', async () => {
    const uploader = await renderSolution('regular');
    const parents = [newParent(), newParent()];
    const elements = composition(uploader);
    for (let i = 0; i < 10; i++) {
      moveNow(elements, parents[i % 2]);
    }
    await settle();
    const recorder = recordEvents(uploader.provider);

    uploader.api.addFileFromObject(IMAGE.PIXEL);
    uploader.api.uploadAll();

    await recorder.waitFor('common-upload-success');
    await delay(100);
    expect(recorder.detailsOf('file-added')).toHaveLength(1);
    expect(recorder.detailsOf('file-upload-success')).toHaveLength(1);
    expect(uploader.provider.getAPI()).toBe(uploader.api);
  });

  it('survives ten synchronous moves spread across tasks with events firing once', async () => {
    const uploader = await renderSolution('regular');
    const parents = [newParent(), newParent()];
    const elements = composition(uploader);
    for (let i = 0; i < 10; i++) {
      moveNow(elements, parents[i % 2]);
      await delay(0);
    }
    await settle();
    const recorder = recordEvents(uploader.provider);

    uploader.api.addFileFromObject(IMAGE.PIXEL);
    uploader.api.setCurrentActivity('upload-list');
    uploader.api.setModalState(true);

    await recorder.waitFor('file-added');
    await delay(100);
    expect(recorder.detailsOf('file-added')).toHaveLength(1);
    expect(recorder.detailsOf('modal-open')).toHaveLength(1);
    expect(uploader.provider.getAPI()).toBe(uploader.api);
    await expectActivity(uploader.root, 'upload-list');
  });

  it('starts cleanly after ten deferred moves', async () => {
    const uploader = await renderSolution('regular');
    const parents = [newParent(), newParent()];
    const elements = composition(uploader);
    for (let i = 0; i < 10; i++) {
      await moveDeferred(elements, parents[i % 2]);
    }
    await settle();
    const api = uploader.provider.getAPI();
    const recorder = recordEvents(uploader.provider);

    api.addFileFromObject(IMAGE.PIXEL);
    api.uploadAll();

    await recorder.waitFor('common-upload-success');
    await delay(100);
    expect(recorder.detailsOf('file-added')).toHaveLength(1);
    expect(recorder.detailsOf('file-upload-success')).toHaveLength(1);
    expect(uploadFile).toHaveBeenCalledOnce();
  });
});

describe.each(SOLUTIONS)('%s: deferred move', (solution) => {
  it('starts a fresh ctx with config re-applied from attributes', async () => {
    const uploader = await renderSolution(solution, { multipleMax: 3, accept: 'image/*' });
    const { api, provider, config, root } = uploader;
    api.addFileFromObject(IMAGE.PIXEL);

    await moveDeferred(composition(uploader), newParent());
    await settle();

    const fresh = provider.getAPI();
    expect(fresh).not.toBe(api);
    expect(fresh.getOutputCollectionState().totalCount).toBe(0);
    expect(() => api.getOutputCollectionState()).toThrow(/was destroyed\. Call getAPI\(\)/);
    expect(config.multipleMax).toBe(3);
    expect(config.accept).toBe('image/*');

    // The fresh ctx works end to end.
    const recorder = recordEvents(provider);
    fresh.addFileFromObject(IMAGE.PIXEL);
    fresh.uploadAll();
    await recorder.waitFor('common-upload-success');
    expect(recorder.detailsOf('file-added')).toHaveLength(1);
    if (solution !== 'regular') await expectActivity(root, 'upload-list');
  });
});

describe('regular: deferred move', () => {
  it('keeps a config value set as a DOM property', async () => {
    const uploader = await renderSolution('regular');
    uploader.config.multipleMax = 7;
    await expect.poll(() => uploader.config.multipleMax).toBe(7);

    await moveDeferred(composition(uploader), newParent());
    await settle();

    expect(uploader.config.multipleMax).toBe(7);
  });

  // A `<uc-file-item>` left in the upload list keeps the `uid` of an entry from the destroyed ctx until the list
  // re-renders; it must adopt the fresh container without asking it for that entry.
  it('re-attaches a list that showed files from the old ctx without warnings', async () => {
    const uploader = await renderSolution('regular');
    uploader.api.addFileFromObject(IMAGE.PIXEL);
    uploader.api.setCurrentActivity('upload-list');
    uploader.api.setModalState(true);
    await expect.element(within(uploader.root).getByText('pixel.jpg')).toBeVisible();
    const warn = vi.spyOn(console, 'warn');

    try {
      await moveDeferred(composition(uploader), newParent());
      await settle();

      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  // Fake-only: telemetry is read back from the emulator, and a live run has none.
  it.skipIf(isLive)('sends nothing from the old ctx once it is gone', async () => {
    const uploader = await renderSolution('regular', { qualityInsights: true });
    await waitForType('init-solution');
    const upload = deferredUpload();
    const oldApi = uploader.api;
    oldApi.addFileFromObject(IMAGE.PIXEL);
    oldApi.uploadAll();
    await vi.waitFor(() => expect(uploadFile).toHaveBeenCalledOnce());
    const { signal } = upload.options();
    await delay(SETTLE_MS);
    const recorder = recordEvents(uploader.provider);

    const elements = composition(uploader);
    for (const element of elements) element.remove();
    await delay(50);
    clearSent();
    // The old upload settles after its ctx is gone.
    upload.finish();
    await delay(SETTLE_MS);

    expect(signal?.aborted).toBe(true);
    expect(sent()).toEqual([]);
    expect(recorder.events).toEqual([]);

    // Re-attach: the fresh ctx reports its own init, not anything from the old one.
    newParent().append(...elements);
    await waitForType('init-solution');
    await delay(SETTLE_MS);
    expect(sent().every((body) => body.session_id === sent()[0].session_id)).toBe(true);
    expect(recorder.detailsOf('file-upload-success')).toEqual([]);
    expect(uploader.provider.getAPI().getOutputCollectionState().totalCount).toBe(0);
  });
});

describe('regular: moving through a <dialog> and a detached container', () => {
  it('keeps state when moved into an open <dialog> and back out', async () => {
    const uploader = await renderSolution('regular');
    uploader.api.addFileFromObject(IMAGE.PIXEL);
    const host = newParent();
    const dialog = document.createElement('dialog');
    host.append(dialog);
    dialog.showModal();

    const elements = composition(uploader);
    moveNow(elements, dialog);
    await settle();
    expect(uploader.provider.getAPI()).toBe(uploader.api);
    uploader.api.setCurrentActivity('upload-list');
    uploader.api.setModalState(true);
    await expectActivity(uploader.root, 'upload-list');
    await expect.element(within(uploader.root).getByText('pixel.jpg')).toBeVisible();

    moveNow(elements, host);
    dialog.close();
    await settle();
    expect(uploader.provider.getAPI()).toBe(uploader.api);
    expect(uploader.api.getOutputCollectionState().totalCount).toBe(1);
    await expectActivity(uploader.root, 'upload-list');
  });

  it('keeps state when parked in a container created and attached in the same task', async () => {
    const uploader = await renderSolution('regular');
    uploader.api.addFileFromObject(IMAGE.PIXEL);
    const elements = composition(uploader);

    // Detached container built on the fly, filled, then attached — all before the task ends.
    const wrapper = document.createElement('div');
    wrapper.append(...elements);
    newParent().append(wrapper);
    await settle();

    expect(uploader.provider.getAPI()).toBe(uploader.api);
    expect(uploader.api.getOutputCollectionState().totalCount).toBe(1);
  });

  it('destroys the ctx when left in a detached container across a task', async () => {
    const uploader = await renderSolution('regular');
    uploader.api.addFileFromObject(IMAGE.PIXEL);
    const elements = composition(uploader);

    const wrapper = document.createElement('div');
    wrapper.append(...elements);
    await settle();
    newParent().append(wrapper);
    await settle();

    expect(() => uploader.api.getOutputCollectionState()).toThrow(/was destroyed/);
    expect(uploader.provider.getAPI().getOutputCollectionState().totalCount).toBe(0);
  });
});
