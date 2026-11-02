import { describe, expect, it, vi } from 'vitest';
import type { Locator } from 'vitest/browser';
import type { Config } from '@/index';
import { settingOf } from '~/tests/utils/camera-settings';
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
 * Picks a camera the way the settings popup does. The fake device exposes a single camera, which keeps the picker
 * hidden, so the change is dispatched on its radio directly; re-picking the same camera still opens a new stream.
 */
const pickCamera = (camera: Locator, deviceId: string): void => {
  const radio = settingOf(camera, 'Camera')
    .radios()
    .find((input) => input.value === deviceId);
  if (!radio) throw new Error(`The camera picker has no ${deviceId}`);
  radio.checked = true;
  radio.dispatchEvent(new Event('change', { bubbles: true }));
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
      const checked = settingOf(camera, 'Camera')
        .radios()
        .find((radio) => radio.checked);
      expect(checked?.value).toBe(deviceId);
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

describe('cameraConstraints', () => {
  const lastVideoRequest = (getUserMedia: Awaited<ReturnType<typeof openCamera>>['getUserMedia']) =>
    getUserMedia.mock.lastCall?.[0]?.video;

  it('replaces the default of the same name and keeps the rest', async () => {
    const { getUserMedia } = await openCamera({ cameraConstraints: { video: { frameRate: { ideal: 15 } } } });

    expect(lastVideoRequest(getUserMedia)).toMatchObject({ width: { ideal: 1920 }, frameRate: { ideal: 15 } });
  });

  it('passes the opening mode to the function form', async () => {
    const custom = vi.fn(() => ({}));
    await openCamera({ cameraModes: 'video, photo', cameraConstraints: custom });

    expect(custom).toHaveBeenCalledWith({ mode: 'video' });
  });

  it('opens the camera without them when it cannot satisfy them', async () => {
    const warn = vi.spyOn(console, 'warn');
    const { getUserMedia } = await openCamera({ cameraConstraints: { video: { width: { exact: 99_999 } } } });

    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(lastVideoRequest(getUserMedia)).toMatchObject({ width: { ideal: 1920 } });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('cannot satisfy cameraConstraints'), expect.anything());
  });

  it('applies a change to the open camera without reopening it', async () => {
    const { camera, config, getUserMedia } = await openCamera();
    const applyConstraints = vi.spyOn(MediaStreamTrack.prototype, 'applyConstraints');
    const track = previewTrack(camera);

    config.cameraConstraints = { video: { frameRate: { ideal: 15 } } };

    await vi.waitFor(() =>
      expect(applyConstraints).toHaveBeenCalledWith(expect.objectContaining({ frameRate: { ideal: 15 } })),
    );
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(previewTrack(camera)).toBe(track);
  });

  it('re-applies the function form when the tab changes', async () => {
    const { camera } = await openCamera({
      cameraConstraints: ({ mode }) => ({ video: { frameRate: { ideal: mode === 'video' ? 24 : 15 } } }),
    });
    const applyConstraints = vi.spyOn(MediaStreamTrack.prototype, 'applyConstraints');

    await camera.getByRole('button', { name: 'Video', exact: true }).click();

    await vi.waitFor(() =>
      expect(applyConstraints).toHaveBeenCalledWith(expect.objectContaining({ frameRate: { ideal: 24 } })),
    );
  });

  it('waits for a recording to stop before applying a change', async () => {
    const { camera, config } = await openCamera();
    await camera.getByRole('button', { name: 'Video', exact: true }).click();
    const applyConstraints = vi.spyOn(MediaStreamTrack.prototype, 'applyConstraints');

    await camera.getByRole('button', { name: 'Shot', exact: true }).click();
    const timer = camera.getByTestId('uc-camera-source--recording-timer');
    await expect.element(timer).toBeVisible();
    config.cameraConstraints = { video: { frameRate: { ideal: 15 } } };
    await expect.poll(() => timer.element().textContent?.trim(), { timeout: 10_000 }).toMatch(/00:0[1-9]/);
    expect(applyConstraints).not.toHaveBeenCalled();

    await camera.getByRole('button', { name: 'Shot', exact: true }).click();

    await vi.waitFor(() =>
      expect(applyConstraints).toHaveBeenCalledWith(expect.objectContaining({ frameRate: { ideal: 15 } })),
    );
  });
});

describe('when camera access is denied', () => {
  it('shows the message without the capture controls', async () => {
    vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
    vi.spyOn(console, 'log').mockImplementation(() => {});

    const rendered = await renderSolution('regular');
    rendered.api.initFlow();
    await expectActivity(rendered.root, 'start-from');
    await within(rendered.root)
      .getByTestId('uc-start-from')
      .getByRole('button', { name: 'Camera', exact: true })
      .click();
    const camera = within(rendered.root).getByTestId('uc-camera-source');

    await expect.element(camera.getByText('Camera access denied')).toBeVisible();
    // Nothing to capture from: a shutter or tab switch here would act on a stream that isn't there.
    for (const name of ['Shot', 'Photo', 'Video']) {
      await expect.element(camera.getByRole('button', { name, exact: true, includeHidden: true })).not.toBeVisible();
    }
  });
});
