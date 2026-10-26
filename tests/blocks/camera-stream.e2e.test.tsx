import { describe, expect, it, vi } from 'vitest';
import type { Locator } from 'vitest/browser';
import type { Config } from '@/index';
import { expectActivity, renderSolution, within } from '~/tests/utils/render-solution';
import '~/types/jsx';

/**
 * How the camera activity opens and replaces its `MediaStream`. Runs against chromium's fake camera
 * (`--use-fake-device-for-media-stream`, vitest.config.ts), so the streams and tracks are real.
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

/** The live preview track. A `<video>` has no ARIA role or test id, hence the tag lookup. */
const previewTrack = (camera: Locator): MediaStreamTrack => {
  const stream = camera.element().querySelector('video')?.srcObject;
  const track = stream instanceof MediaStream ? stream.getVideoTracks()[0] : undefined;
  if (!track) throw new Error('The camera preview has no video track');
  return track;
};

/**
 * Picks a camera the way the header picker does. The fake device exposes a single camera, which keeps the picker
 * hidden, so the change is dispatched on it directly; re-picking the same camera still opens a new stream.
 */
const pickCamera = (camera: Locator, deviceId: string): void => {
  const select = camera.element().querySelector('uc-select.uc-camera-select');
  if (!select) throw new Error('The camera picker is not rendered');
  (select as HTMLElement & { value: string }).value = deviceId;
  select.dispatchEvent(new Event('change'));
};

describe('opening the camera', () => {
  it('asks for the camera once', async () => {
    const { getUserMedia } = await openCamera();

    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });

  it('shows the camera in use as selected in the picker', async () => {
    const { camera } = await openCamera();
    const deviceId = previewTrack(camera).getSettings().deviceId;

    await vi.waitFor(() => {
      const select = camera.element().querySelector('uc-select.uc-camera-select') as { value: string } | null;
      expect(select?.value).toBe(deviceId);
    });
  });
});

describe('picking a camera', () => {
  it('keeps the default resolution', async () => {
    const { camera, getUserMedia } = await openCamera();
    const deviceId = previewTrack(camera).getSettings().deviceId ?? '';

    pickCamera(camera, deviceId);

    await vi.waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));
    expect(getUserMedia.mock.lastCall?.[0]?.video).toMatchObject({
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      deviceId: { exact: deviceId },
    });
  });

  it('stops the old stream', async () => {
    const { camera } = await openCamera();
    const oldTrack = previewTrack(camera);

    pickCamera(camera, oldTrack.getSettings().deviceId ?? '');

    await vi.waitFor(() => expect(previewTrack(camera)).not.toBe(oldTrack), { timeout: 20_000 });
    expect(oldTrack.readyState).toBe('ended');
  });

  it('stops a stream that arrives after a newer request', async () => {
    const { camera, getUserMedia } = await openCamera();
    const deviceId = previewTrack(camera).getSettings().deviceId ?? '';
    const opened: MediaStream[] = [];
    getUserMedia.mockImplementation(async function (this: MediaDevices, constraints) {
      const stream = await MediaDevices.prototype.getUserMedia.call(this, constraints);
      opened.push(stream);
      return stream;
    });

    pickCamera(camera, deviceId);
    pickCamera(camera, deviceId);

    await vi.waitFor(() => expect(opened).toHaveLength(2), { timeout: 20_000 });
    await vi.waitFor(() => expect(previewTrack(camera)).toBe(opened[1]?.getVideoTracks()[0]));
    const live = opened.filter((stream) => stream.getTracks().some((track) => track.readyState === 'live'));
    expect(live).toEqual([opened[1]]);
  });
});
