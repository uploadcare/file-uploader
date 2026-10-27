import { describe, expect, it, vi } from 'vitest';
import type { Locator } from 'vitest/browser';
import type { Config } from '@/index';
import { expectActivity, renderSolution, within } from '~/tests/utils/render-solution';
import '~/types/jsx';

/**
 * `cameraAspectRatio` against chromium's fake camera (`--use-fake-device-for-media-stream`, vitest.config.ts): photos
 * and videos are both cropped to the ratio, and the preview shows the crop.
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

/** Records about a second of video, accepts it and returns the file and its pixel size. */
const recordVideo = async ({ api, camera }: Awaited<ReturnType<typeof openCamera>>) => {
  await camera.getByRole('button', { name: 'Video', exact: true }).click();
  await camera.getByRole('button', { name: 'Shot', exact: true }).click();
  const timer = camera.getByTestId('uc-camera-source--recording-timer');
  await expect.poll(() => timer.element().textContent?.trim(), { timeout: 10_000 }).toMatch(/00:0[1-9]/);
  await camera.getByRole('button', { name: 'Shot', exact: true }).click();
  await camera.getByRole('button', { name: 'Accept', exact: true }).click();

  await expect.poll(() => api.getOutputCollectionState().totalCount, { timeout: 20_000 }).toBe(1);
  const [entry] = api.getOutputCollectionState().allEntries;
  if (!entry.file) throw new Error('The video entry has no file');
  const player = document.createElement('video');
  player.muted = true;
  player.src = URL.createObjectURL(entry.file);
  await new Promise((resolve, reject) => {
    player.onloadedmetadata = resolve;
    player.onerror = reject;
  });
  return { width: player.videoWidth, height: player.videoHeight };
};

/** Keeps the fake camera in its own 16:9 shape, so the recording has to be cropped frame by frame. */
const NATIVE_FRAMES: Partial<Config> = {
  cameraConstraints: { video: { resizeMode: 'none' } as MediaTrackConstraints },
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

describe('cameraAspectRatio in video mode', () => {
  it('records a square clip when the camera delivers the ratio itself', async () => {
    const captureStream = vi.spyOn(HTMLCanvasElement.prototype, 'captureStream');
    const opened = await openCamera({ cameraAspectRatio: '1:1' });

    const clip = await recordVideo(opened);

    expect(clip.width).toBe(clip.height);
    // Chromium crops the camera itself here, so there is nothing to redraw.
    expect(captureStream).not.toHaveBeenCalled();
  });

  it('crops the clip frame by frame when the camera keeps its own shape', async () => {
    const captureStream = vi.spyOn(HTMLCanvasElement.prototype, 'captureStream');
    const opened = await openCamera({ cameraAspectRatio: '1:1', ...NATIVE_FRAMES });
    const video = await preview(opened.camera);
    expect(video.videoWidth / video.videoHeight).toBeCloseTo(16 / 9, 2);

    const clip = await recordVideo(opened);

    expect(clip.width).toBe(clip.height);
    expect(clip.width).toBe(video.videoHeight);
    expect(captureStream).toHaveBeenCalled();
  });

  it('records portrait from a landscape camera', async () => {
    const opened = await openCamera({ cameraAspectRatio: '9:16', ...NATIVE_FRAMES });

    const clip = await recordVideo(opened);

    expect(clip.width / clip.height).toBeCloseTo(9 / 16, 1);
  });

  it('shows the video preview in the ratio', async () => {
    const { camera } = await openCamera({ cameraAspectRatio: '1:1', ...NATIVE_FRAMES });
    await camera.getByRole('button', { name: 'Video', exact: true }).click();
    const video = await preview(camera);

    expect(boxRatio(video)).toBeCloseTo(1, 1);
    expect(getComputedStyle(video).objectFit).toBe('cover');
  });

  it('mirrors the clip like a photo, and plays it back without mirroring it again', async () => {
    const scale = vi.spyOn(CanvasRenderingContext2D.prototype, 'scale');
    const opened = await openCamera({ cameraMirror: true });

    await opened.camera.getByRole('button', { name: 'Video', exact: true }).click();
    await opened.camera.getByRole('button', { name: 'Shot', exact: true }).click();
    const timer = opened.camera.getByTestId('uc-camera-source--recording-timer');
    await expect.poll(() => timer.element().textContent?.trim(), { timeout: 10_000 }).toMatch(/00:0[1-9]/);
    await opened.camera.getByRole('button', { name: 'Shot', exact: true }).click();

    expect(scale).toHaveBeenCalledWith(-1, 1);
    await expect.element(opened.camera.getByRole('button', { name: 'Accept', exact: true })).toBeVisible();
    const video = await preview(opened.camera);
    expect(getComputedStyle(video).transform).toBe('none');
  });

  it('records the camera as is, with a warning, where canvas recording is missing', async () => {
    const original = HTMLCanvasElement.prototype.captureStream;
    Object.defineProperty(HTMLCanvasElement.prototype, 'captureStream', { value: undefined, configurable: true });
    const warn = vi.spyOn(console, 'warn');
    try {
      const opened = await openCamera({ cameraAspectRatio: '1:1', ...NATIVE_FRAMES });

      const clip = await recordVideo(opened);

      expect(clip.width / clip.height).toBeCloseTo(16 / 9, 2);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('cannot crop or mirror video recordings'));
    } finally {
      Object.defineProperty(HTMLCanvasElement.prototype, 'captureStream', { value: original, configurable: true });
    }
  });
});
