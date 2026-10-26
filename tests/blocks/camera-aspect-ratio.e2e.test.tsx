import { describe, expect, it, vi } from 'vitest';
import type { Locator } from 'vitest/browser';
import type { Config } from '@/index';
import { expectActivity, renderSolution, within } from '~/tests/utils/render-solution';
import '~/types/jsx';

/**
 * `cameraAspectRatio` against chromium's fake camera (`--use-fake-device-for-media-stream`, vitest.config.ts): photos
 * are cropped to the ratio and the photo preview shows the crop; video is only asked for it.
 */

const openCamera = async (configProps: Partial<Config> = {}) => {
  const getUserMedia = vi.spyOn(navigator.mediaDevices, 'getUserMedia');

  const rendered = await renderSolution('regular', configProps);
  rendered.api.initFlow();
  await expectActivity(rendered.root, 'start-from');

  await within(rendered.root).getByTestId('uc-start-from').getByRole('button', { name: 'Camera', exact: true }).click();
  await expectActivity(rendered.root, 'camera');

  const camera = within(rendered.root).getByTestId('uc-camera-source');
  await expect.element(camera.getByRole('button', { name: 'Shot', exact: true }), { timeout: 20_000 }).toBeVisible();

  return { ...rendered, camera, getUserMedia };
};

/** The preview `<video>`, once it shows frames. It has no ARIA role or test id, hence the tag lookup. */
const preview = (camera: Locator) =>
  vi.waitFor(
    () => {
      const video = camera.element().querySelector('video');
      if (!video?.checkVisibility() || video.videoWidth === 0) throw new Error('The camera preview is not showing');
      return video;
    },
    { timeout: 20_000 },
  );

const boxRatio = (element: Element) => {
  const { width, height } = element.getBoundingClientRect();
  return width / height;
};

/** Takes a photo, accepts it and returns its pixel size. */
const takePhoto = async ({ api, camera }: Awaited<ReturnType<typeof openCamera>>) => {
  await camera.getByRole('button', { name: 'Shot', exact: true }).click();
  await camera.getByRole('button', { name: 'Accept', exact: true }).click();

  await expect.poll(() => api.getOutputCollectionState().totalCount).toBe(1);
  const [entry] = api.getOutputCollectionState().allEntries;
  if (!entry.file) throw new Error('The photo entry has no file');
  const bitmap = await createImageBitmap(entry.file);
  return { width: bitmap.width, height: bitmap.height };
};

describe('cameraAspectRatio', () => {
  it('keeps the frame shape by default', async () => {
    const opened = await openCamera();
    const video = await preview(opened.camera);
    const frame = { width: video.videoWidth, height: video.videoHeight };

    expect(await takePhoto(opened)).toEqual(frame);
  });

  it('crops the photo to a square', async () => {
    const opened = await openCamera({ cameraAspectRatio: '1:1' });
    const video = await preview(opened.camera);

    const photo = await takePhoto(opened);

    expect(photo.width).toBe(photo.height);
    expect(photo.width).toBe(Math.min(video.videoWidth, video.videoHeight));
  });

  it('crops the photo to portrait from a landscape frame', async () => {
    const opened = await openCamera({ cameraAspectRatio: '9:16' });

    const photo = await takePhoto(opened);

    expect(photo.width / photo.height).toBeCloseTo(9 / 16, 2);
  });

  it('asks the camera for the ratio', async () => {
    const { getUserMedia } = await openCamera({ cameraAspectRatio: '4:3' });

    expect(getUserMedia.mock.lastCall?.[0]?.video).toMatchObject({ aspectRatio: { ideal: 4 / 3 } });
  });

  it('shows the photo preview in the ratio', async () => {
    const { camera } = await openCamera({ cameraAspectRatio: '1:1' });
    const video = await preview(camera);

    expect(boxRatio(video)).toBeCloseTo(1, 1);
    expect(getComputedStyle(video).objectFit).toBe('cover');
    // Fits the content area on one side rather than shrinking: the box ratio alone would pass for a tiny preview.
    const area = video.parentElement;
    if (!area) throw new Error('The preview has no content area');
    const style = getComputedStyle(area);
    const areaWidth = area.clientWidth - Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight);
    const areaHeight = area.clientHeight - Number.parseFloat(style.paddingTop) - Number.parseFloat(style.paddingBottom);
    const box = video.getBoundingClientRect();
    expect(Math.max(box.width / areaWidth, box.height / areaHeight)).toBeGreaterThan(0.95);
  });

  it('shows the real frame in video mode', async () => {
    const { camera } = await openCamera({ cameraAspectRatio: '1:1' });
    await camera.getByRole('button', { name: 'Video', exact: true }).click();
    const video = await preview(camera);

    await expect.poll(() => getComputedStyle(video).objectFit).toBe('contain');
    expect(video.style.aspectRatio).toBe('');
  });

  it('applies a change to the open camera', async () => {
    const { camera, config, getUserMedia } = await openCamera();
    const video = await preview(camera);
    const applyConstraints = vi.spyOn(MediaStreamTrack.prototype, 'applyConstraints');

    config.cameraAspectRatio = '1:1';

    await expect.poll(() => boxRatio(video)).toBeCloseTo(1, 1);
    await vi.waitFor(() =>
      expect(applyConstraints).toHaveBeenCalledWith(expect.objectContaining({ aspectRatio: { ideal: 1 } })),
    );
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });

  it('falls back to the native shape for an invalid value', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const opened = await openCamera({ cameraAspectRatio: '16/9' });
    const video = await preview(opened.camera);

    expect(opened.config.cameraAspectRatio).toBe('');
    expect(await takePhoto(opened)).toEqual({ width: video.videoWidth, height: video.videoHeight });
  });
});
