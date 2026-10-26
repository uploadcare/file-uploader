import { describe, expect, it, vi } from 'vitest';
import type { Config } from '@/index';
import { expectActivity, renderSolution, within } from '~/tests/utils/render-solution';
import '~/types/jsx';

/** `cameraQuality` and `cameraPhotoQuality` against chromium's fake camera (`--use-fake-device-for-media-stream`). */

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

/** Takes a photo, accepts it and returns its file. */
const takePhoto = async ({ api, camera }: Awaited<ReturnType<typeof openCamera>>) => {
  await camera.getByRole('button', { name: 'Shot', exact: true }).click();
  await camera.getByRole('button', { name: 'Accept', exact: true }).click();

  await expect.poll(() => api.getOutputCollectionState().totalCount).toBe(1);
  const [entry] = api.getOutputCollectionState().allEntries;
  if (!entry.file) throw new Error('The photo entry has no file');
  return entry.file;
};

describe('cameraQuality', () => {
  it('asks for 1920×1080 by default', async () => {
    const { getUserMedia } = await openCamera();

    expect(getUserMedia.mock.lastCall?.[0]?.video).toMatchObject({ width: { ideal: 1920 }, height: { ideal: 1080 } });
  });

  it('sets the short side, with the long side from the aspect ratio', async () => {
    const { getUserMedia } = await openCamera({ cameraQuality: '720p', cameraAspectRatio: '3:4' });

    expect(getUserMedia.mock.lastCall?.[0]?.video).toMatchObject({ width: { ideal: 720 }, height: { ideal: 960 } });
  });

  it('applies a change to the open camera without reopening it', async () => {
    const { config, getUserMedia } = await openCamera();
    const applyConstraints = vi.spyOn(MediaStreamTrack.prototype, 'applyConstraints');

    config.cameraQuality = '720p';

    await vi.waitFor(() =>
      expect(applyConstraints).toHaveBeenCalledWith(
        expect.objectContaining({ width: { ideal: 1280 }, height: { ideal: 720 } }),
      ),
    );
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });

  it('falls back to auto for an unknown preset', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { config } = await openCamera({ cameraQuality: '8k' as Config['cameraQuality'] });

    expect(config.cameraQuality).toBe('auto');
  });
});

describe('cameraPhotoQuality', () => {
  it('encodes the photo with the given JPEG quality', async () => {
    const low = await takePhoto(await openCamera({ cameraPhotoQuality: 0.05 }));
    const high = await takePhoto(await openCamera({ cameraPhotoQuality: 1 }));

    expect(low.type).toBe('image/jpeg');
    expect(low.size).toBeLessThan(high.size / 2);
  });

  it('falls back to the default outside 0..1', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { config } = await openCamera({ cameraPhotoQuality: 2 });

    expect(config.cameraPhotoQuality).toBe(0.92);
  });
});
