import { describe, expect, it, vi } from 'vitest';
import type { Config } from '@/index';
import { expectActivity, renderSolution, within } from '~/tests/utils/render-solution';
import '~/types/jsx';

/**
 * Photos via `ImageCapture.takePhoto()`, with the preview frame as the fallback. chromium has `ImageCapture`; a fake
 * `takePhoto()` returning a 800×600 image tells its photos apart from the fake camera's own frames.
 */

type ImageCaptureLike = { prototype: { takePhoto: (settings?: unknown) => Promise<Blob> } };
const ImageCaptureClass = () => (window as unknown as { ImageCapture: ImageCaptureLike }).ImageCapture;

/** A still of `width`×`height`, as `takePhoto()` would return it. */
const still = async (width: number, height: number) => {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2d context');
  ctx.fillStyle = '#c00';
  ctx.fillRect(0, 0, width, height);
  return canvas.convertToBlob({ type: 'image/png' });
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const openCamera = async (configProps: Partial<Config> = {}) => {
  const rendered = await renderSolution('regular', configProps);
  rendered.api.initFlow();
  await expectActivity(rendered.root, 'start-from');
  await within(rendered.root).getByTestId('uc-start-from').getByRole('button', { name: 'Camera', exact: true }).click();
  await expectActivity(rendered.root, 'camera');

  const camera = within(rendered.root).getByTestId('uc-camera-source');
  const shot = camera.getByRole('button', { name: 'Shot', exact: true });
  await expect.element(shot, { timeout: 20_000 }).toBeVisible();

  const video = camera.element().querySelector('video');
  if (!video) throw new Error('The camera preview is not rendered');
  await vi.waitFor(() => expect(video.videoWidth).toBeGreaterThan(0));

  return {
    ...rendered,
    camera,
    frame: { width: video.videoWidth, height: video.videoHeight },
    shoot: () => shot.click(),
    retake: () => camera.getByText('Retake', { exact: true }).click(),
    accept: () => camera.getByRole('button', { name: 'Accept', exact: true }).click(),
  };
};

/** The pixel size of the photo that was added. */
const addedPhotoSize = async (api: Awaited<ReturnType<typeof openCamera>>['api']) => {
  await expect.poll(() => api.getOutputCollectionState().totalCount, { timeout: 10_000 }).toBe(1);
  const [entry] = api.getOutputCollectionState().allEntries;
  if (!entry.file) throw new Error('The photo entry has no file');
  expect(entry.file.type).toBe('image/jpeg');
  const bitmap = await createImageBitmap(entry.file);
  return { width: bitmap.width, height: bitmap.height };
};

describe('photos with ImageCapture', () => {
  it('uses the still from takePhoto', async () => {
    const takePhoto = vi.spyOn(ImageCaptureClass().prototype, 'takePhoto').mockImplementation(() => still(800, 600));
    const opened = await openCamera();

    await opened.shoot();
    await opened.accept();

    expect(takePhoto).toHaveBeenCalledTimes(1);
    expect(await addedPhotoSize(opened.api)).toEqual({ width: 800, height: 600 });
  });

  it('asks for the size the stream runs at, so the camera keeps its configuration', async () => {
    // Real cameras can switch modes for any other size, leaving the preview changed after a retake; the fake camera
    // can't show that, so this pins the request instead.
    const takePhoto = vi.spyOn(ImageCaptureClass().prototype, 'takePhoto');
    const opened = await openCamera({ cameraResolution: '720p' });
    const track = (opened.camera.element().querySelector('video')?.srcObject as MediaStream).getVideoTracks()[0];
    const before = track.getSettings();

    await opened.shoot();
    await vi.waitFor(() => expect(takePhoto).toHaveBeenCalled());
    await opened.retake();

    expect(takePhoto).toHaveBeenCalledWith({ imageWidth: before.width, imageHeight: before.height });
    expect(track.getSettings()).toMatchObject({ width: before.width, height: before.height });
  });

  it('crops the still to the aspect ratio', async () => {
    vi.spyOn(ImageCaptureClass().prototype, 'takePhoto').mockImplementation(() => still(800, 600));
    const opened = await openCamera({ cameraAspectRatio: '1:1' });

    await opened.shoot();
    await opened.accept();

    expect(await addedPhotoSize(opened.api)).toEqual({ width: 600, height: 600 });
  });

  it('waits for a still that is still on its way when accepted', async () => {
    vi.spyOn(ImageCaptureClass().prototype, 'takePhoto').mockImplementation(async () => {
      await delay(800);
      return still(800, 600);
    });
    const opened = await openCamera();

    await opened.shoot();
    await opened.accept();

    expect(await addedPhotoSize(opened.api)).toEqual({ width: 800, height: 600 });
  });

  it('discards a late still after a retake', async () => {
    let calls = 0;
    vi.spyOn(ImageCaptureClass().prototype, 'takePhoto').mockImplementation(async () => {
      calls += 1;
      if (calls === 1) {
        await delay(800);
        return still(800, 600);
      }
      return still(400, 300);
    });
    const opened = await openCamera();

    await opened.shoot();
    await opened.retake();
    await opened.shoot();
    await delay(1000);
    await opened.accept();

    expect(await addedPhotoSize(opened.api)).toEqual({ width: 400, height: 300 });
  });
});

describe('photos without ImageCapture', () => {
  it('use the preview frame where ImageCapture is missing', async () => {
    vi.stubGlobal('ImageCapture', undefined);
    const opened = await openCamera();

    await opened.shoot();
    await opened.accept();

    expect(await addedPhotoSize(opened.api)).toEqual(opened.frame);
  });

  it('keep the preview frame, with a warning, when takePhoto fails', async () => {
    vi.spyOn(ImageCaptureClass().prototype, 'takePhoto').mockRejectedValue(
      new DOMException('busy', 'InvalidStateError'),
    );
    const warn = vi.spyOn(console, 'warn');
    const opened = await openCamera();

    await opened.shoot();
    await opened.accept();

    expect(await addedPhotoSize(opened.api)).toEqual(opened.frame);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('ImageCapture could not take the photo'),
      expect.anything(),
    );
  });
});
