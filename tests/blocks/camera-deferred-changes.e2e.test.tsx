import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Locator } from 'vitest/browser';
import { CameraActionEvent } from '@/blocks/CameraSource/CameraActionEvent';
import type { Config } from '@/index';
import { settingOf } from '~/tests/utils/camera-settings';
import { expectActivity, renderSolution, within } from '~/tests/utils/render-solution';
import '~/types/jsx';

/**
 * Changes the camera holds back until it can apply them, against chromium's fake devices: a microphone picked during a
 * recording, and the shutter while another camera opens. Pins today's behaviour before the camera session is split.
 */

const realGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);

afterEach(() => {
  vi.restoreAllMocks();
});

const openCamera = async (configProps: Partial<Config> = {}, { video = true } = {}) => {
  const getUserMedia = vi.spyOn(navigator.mediaDevices, 'getUserMedia');
  const rendered = await renderSolution('regular', configProps);
  rendered.api.initFlow();
  await expectActivity(rendered.root, 'start-from');
  await within(rendered.root).getByTestId('uc-start-from').getByRole('button', { name: 'Camera', exact: true }).click();
  await expectActivity(rendered.root, 'camera');
  const camera = within(rendered.root).getByTestId('uc-camera-source');
  const shot = camera.getByTestId('uc-camera-controls--shot');
  await expect.element(shot, { timeout: 20_000 }).toBeVisible();
  if (video) await camera.getByRole('button', { name: 'Video', exact: true }).click();
  await expect.element(shot, { timeout: 20_000 }).toBeEnabled();
  return { ...rendered, camera, getUserMedia, shot };
};

const liveStream = (camera: Locator): MediaStream => {
  const stream = camera.element().querySelector('video')?.srcObject;
  if (!(stream instanceof MediaStream)) throw new Error('The camera preview has no stream');
  return stream;
};

/** Picks a microphone in the settings popup without opening it, as a user's pick would. */
const pickMicrophone = (camera: Locator, deviceId: string) => {
  const radio = settingOf(camera, 'Microphone')
    .radios()
    .find((input) => input.value === deviceId);
  if (!radio) throw new Error(`The microphone picker has no ${deviceId}`);
  radio.checked = true;
  radio.dispatchEvent(new Event('change', { bubbles: true }));
};

const gate = () => {
  let open!: () => void;
  const closed = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { closed, open };
};

describe('camera deferred changes', () => {
  it('a microphone change made during a recording applies after the stop', async () => {
    const { camera, shot } = await openCamera();
    const stream = liveStream(camera);
    const inUse = stream.getAudioTracks()[0]?.getSettings().deviceId;
    const other = await vi.waitFor(() => {
      const value = settingOf(camera, 'Microphone')
        .radios()
        .find((radio) => radio.value !== inUse)?.value;
      if (!value) throw new Error('The fake device offers a single microphone');
      return value;
    });

    await shot.click();
    await expect.element(camera.getByTestId('uc-camera-controls--recording-timer')).toBeVisible();
    pickMicrophone(camera, other);
    expect(stream.getAudioTracks()[0]?.getSettings().deviceId).toBe(inUse);

    await shot.click();
    await expect.element(camera.getByRole('button', { name: 'Accept', exact: true })).toBeVisible();

    await vi.waitFor(() => expect(stream.getAudioTracks()[0]?.getSettings().deviceId).toBe(other), {
      timeout: 5000,
    });
  });

  it("switching the camera disables the shutter until the new camera's first frame", async () => {
    const { camera, getUserMedia, shot } = await openCamera({}, { video: false });
    const deviceId = liveStream(camera).getVideoTracks()[0]?.getSettings().deviceId ?? '';
    // Simulated: a camera that takes a while to open. Chromium's fake device offers one camera, so the switch picks it
    // again, which reopens it all the same.
    const reopen = gate();
    getUserMedia.mockImplementation(async (constraints) => {
      if (constraints?.video) await reopen.closed;
      return realGetUserMedia(constraints);
    });

    camera
      .element()
      .querySelector('uc-camera-preview')
      ?.dispatchEvent(new CameraActionEvent({ type: 'select-camera', deviceId }));

    await expect.element(shot).toBeDisabled();
    reopen.open();
    await expect.element(shot, { timeout: 10_000 }).toBeEnabled();
  });
});
