import type { UploadcareFile } from '@uploadcare/upload-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { delay } from '@/utils/delay';
import { IMAGE } from '~/tests/fixtures/files';
import { recordEvents } from '~/tests/utils/event-recorder';
import {
  expectActivity,
  expectModal,
  modalDialog,
  type RenderedUploader,
  renderSolution,
  within,
} from '~/tests/utils/render-solution';
import { getCtxName } from '~/tests/utils/test-renderer';
import '~/types/jsx';

/**
 * Re-mounting the uploader while an activity is on screen: the modal, each built-in activity, the cloud image editor
 * and the camera. Every move here completes within one task, so the ctx survives (`ChildBlock` defers its teardown by
 * `setTimeout(0)`), while every block is disconnected and re-adopted — which is what these exercise.
 */

const uploadFile = vi.hoisted(() => vi.fn());

vi.mock('@uploadcare/upload-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@uploadcare/upload-client')>();
  return { ...actual, uploadFile };
});

/** A real image on the default CDN, so the editor has something to load. */
const UUID = 'f4dc9ebc-ed6d-4b4d-83d1-863bf1e4bb7f';
const UPLOADED = {
  uuid: UUID,
  name: 'pixel.jpg',
  originalFilename: 'pixel.jpg',
  size: 1,
  isImage: true,
  isStored: true,
  mimeType: 'image/jpeg',
  cdnUrl: `https://ucarecdn.com/${UUID}/`,
  cdnUrlModifiers: '',
  imageInfo: { width: 512, height: 512, format: 'JPEG', orientation: null },
  videoInfo: null,
  contentInfo: null,
  metadata: {},
  s3Bucket: null,
  s3Url: null,
} as unknown as UploadcareFile;

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

const newParent = (): HTMLElement => {
  const id = getCtxName();
  page.render(<div id={id}></div>);
  return document.getElementById(id) as HTMLElement;
};

/** Moves the whole composition to a fresh parent within the current task, then lets it settle. */
const moveComposition = async ({ root }: RenderedUploader) => {
  newParent().append(...Array.from((root.parentElement as HTMLElement).children));
  // Negative wait: a ctx teardown, had one been scheduled, lands in a `setTimeout(0)`.
  await delay(50);
};

/** Open in the top layer, not merely carrying the `open` attribute: what makes it a modal the user can dismiss. */
const expectTopLayerModal = async (root: HTMLElement, id: string) => {
  await expectModal(root, id, 'open');
  await expect.poll(() => modalDialog(root, id)?.matches(':modal')).toBe(true);
};

describe('regular: moving with the modal open', () => {
  // Removing an open modal `<dialog>` drops it out of the top layer but keeps its `open` attribute (HTML "dialog
  // removing steps"); `Modal.show()` puts it back on re-attach, so it keeps its backdrop, focus trap and Escape.
  it('keeps start-from shown as a top-layer modal', async () => {
    const uploader = await renderSolution('regular');
    uploader.api.initFlow();
    await expectTopLayerModal(uploader.root, 'start-from');

    await moveComposition(uploader);

    await expectActivity(uploader.root, 'start-from');
    await expect.poll(() => modalDialog(uploader.root, 'start-from')?.matches(':modal'), { timeout: 2000 }).toBe(true);
  });

  it('keeps start-from active and navigable', async () => {
    const uploader = await renderSolution('regular');
    uploader.api.initFlow();
    await expectModal(uploader.root, 'start-from', 'open');

    await moveComposition(uploader);

    await expectActivity(uploader.root, 'start-from');
    await expectModal(uploader.root, 'start-from', 'open');
    await within(uploader.root).getByTestId('uc-start-from').getByText('From link', { exact: true }).click();
    await expectActivity(uploader.root, 'url');
    expect(uploader.api.getCurrentActivity()).toBe('url');
  });

  it('closes through the api after the move', async () => {
    const uploader = await renderSolution('regular');
    const recorder = recordEvents(uploader.provider);
    uploader.api.initFlow();
    await expectModal(uploader.root, 'start-from', 'open');

    await moveComposition(uploader);
    uploader.api.doneFlow();

    await expectModal(uploader.root, 'start-from', 'closed');
    expect(uploader.api.getCurrentActivity()).toBeNull();
    await vi.waitFor(() => expect(recorder.detailsOf('modal-close')).toHaveLength(1));
    // Opening again shows it again.
    uploader.api.initFlow();
    await expectModal(uploader.root, 'start-from', 'open');
  });

  // Same mechanism as the top-layer case above: only a modal dialog has the close watcher Escape goes through.
  it('closes on Escape after the move', async () => {
    const uploader = await renderSolution('regular');
    uploader.api.initFlow();
    await expectModal(uploader.root, 'start-from', 'open');

    await moveComposition(uploader);
    await userEvent.keyboard('{Escape}');

    await expect.poll(() => modalDialog(uploader.root, 'start-from')?.open, { timeout: 2000 }).toBe(false);
    expect(uploader.api.getCurrentActivity()).toBeNull();
  });

  it('keeps the upload list and can go back to start-from', async () => {
    const uploader = await renderSolution('regular');
    uploader.api.addFileFromObject(IMAGE.PIXEL);
    uploader.api.initFlow();
    await expectModal(uploader.root, 'upload-list', 'open');

    await moveComposition(uploader);

    await expectActivity(uploader.root, 'upload-list');
    await expectModal(uploader.root, 'upload-list', 'open');
    await expect.element(within(uploader.root).getByText('pixel.jpg')).toBeVisible();
    await within(uploader.root).getByTestId('uc-upload-list').getByRole('button', { name: 'Add more' }).click();
    await expectActivity(uploader.root, 'start-from');
  });

  it('keeps the url source usable', async () => {
    const uploader = await renderSolution('regular');
    uploader.api.initFlow();
    await within(uploader.root).getByTestId('uc-start-from').getByText('From link', { exact: true }).click();
    await expectActivity(uploader.root, 'url');

    await moveComposition(uploader);

    await expectActivity(uploader.root, 'url');
    const urlSource = within(uploader.root).getByTestId('uc-url-source');
    await urlSource.getByPlaceholder('https://').fill('https://example.com/image.jpg');
    await urlSource.getByRole('button', { name: 'Import', exact: true }).click();
    await expect.poll(() => uploader.api.getOutputCollectionState().totalCount).toBe(1);
    await expectActivity(uploader.root, 'upload-list');
  });
});

describe.each(['inline', 'minimal'] as const)('%s: moving with an activity on screen', (solution) => {
  it('keeps start-from active and navigable', async () => {
    const uploader = await renderSolution(solution);
    if (solution === 'minimal') uploader.api.initFlow();
    await expectActivity(uploader.root, 'start-from');

    await moveComposition(uploader);

    await expectActivity(uploader.root, 'start-from');
    await within(uploader.root).getByTestId('uc-start-from').getByText('From link', { exact: true }).click();
    await expectActivity(uploader.root, 'url');
  });

  it('keeps the upload list showing its files', async () => {
    const uploader = await renderSolution(solution);
    uploader.api.addFileFromObject(IMAGE.PIXEL);
    await expectActivity(uploader.root, 'upload-list');

    await moveComposition(uploader);

    await expectActivity(uploader.root, 'upload-list');
    await expect.element(within(uploader.root).getByText('pixel.jpg')).toBeVisible();
  });
});

describe('regular: moving with the cloud image editor open', () => {
  const openEditor = async () => {
    const uploader = await renderSolution('regular', { cdnCname: 'https://ucarecdn.com/' });
    const entry = uploader.api.addFileFromObject(IMAGE.PIXEL);
    uploader.api.uploadAll();
    await expect.poll(() => uploader.api.getOutputItem(entry.internalId).status).toBe('success');
    uploader.api.navigate('cloud-image-edit', { internalId: entry.internalId });
    await expectActivity(uploader.root, 'cloud-image-edit');
    const editor = within(uploader.root).getByTestId('uc-cloud-image-editor');
    await expect.element(editor).toBeVisible();
    return { uploader, entry, editor };
  };

  it('still applies an edit after the move', async () => {
    const { uploader, entry, editor } = await openEditor();
    // The crop toolbar is the sign the editor is interactive.
    await expect.element(editor.getByTestId('uc-editor-crop-button-control').first()).toBeVisible();

    await moveComposition(uploader);

    await expectActivity(uploader.root, 'cloud-image-edit');
    const moved = within(uploader.root).getByTestId('uc-cloud-image-editor');
    await expect.element(moved.getByTestId('uc-editor-crop-button-control').first()).toBeVisible();
    await userEvent.click(moved.getByTestId('uc-editor-crop-button-control').first());
    await userEvent.click(moved.getByRole('button', { name: /apply/i }));

    await expect.poll(() => uploader.api.getCurrentActivity()).not.toBe('cloud-image-edit');
    await expect.poll(() => uploader.api.getOutputItem(entry.internalId).cdnUrlModifiers).toMatch(/rotate/);
  });

  it('finishes loading and cancels when moved before the image loaded', async () => {
    const { uploader } = await openEditor();

    // No wait for the image: the move lands while the editor is still loading it.
    await moveComposition(uploader);

    const moved = within(uploader.root).getByTestId('uc-cloud-image-editor');
    await expect.element(moved.getByTestId('uc-editor-crop-button-control').first()).toBeVisible();
    await userEvent.click(moved.getByRole('button', { name: 'Cancel' }).first());
    await expect.poll(() => uploader.api.getCurrentActivity()).not.toBe('cloud-image-edit');
  });
});

describe('regular: moving while the camera is active', () => {
  it('releases the stream on detach and captures again after re-attach', async () => {
    const streams: MediaStream[] = [];
    const getUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    const spy = vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockImplementation(async (constraints) => {
      const stream = await getUserMedia(constraints);
      streams.push(stream);
      return stream;
    });

    try {
      const uploader = await renderSolution('regular');
      uploader.api.initFlow();
      await within(uploader.root).getByTestId('uc-start-from').getByText('Camera', { exact: true }).click();
      await expectActivity(uploader.root, 'camera');
      const video = () => uploader.root.querySelector<HTMLVideoElement>('uc-camera-source video');
      await expect.poll(() => video()?.srcObject instanceof MediaStream).toBe(true);
      const first = video()?.srcObject as MediaStream;
      const openedBefore = streams.length;

      await moveComposition(uploader);

      // Every stream opened before the move is released — the permission probe too, not just the one on screen.
      for (const stream of streams.slice(0, openedBefore)) {
        expect(stream.getTracks().every((track) => track.readyState === 'ended')).toBe(true);
      }
      await expectActivity(uploader.root, 'camera');
      await expect.poll(() => video()?.srcObject instanceof MediaStream && video()?.srcObject !== first).toBe(true);
      const second = video()?.srcObject as MediaStream;
      expect(second.getVideoTracks()[0]?.readyState).toBe('live');
      await expect
        .element(within(uploader.root).getByTestId('uc-camera-source').getByTestId('uc-camera-controls--shot'))
        .toBeVisible();

      // Leaving the camera releases the new stream as well.
      uploader.api.doneFlow();
      await expect.poll(() => second.getTracks().every((track) => track.readyState === 'ended')).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });
});
