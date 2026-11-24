import { describe, expect, it, onTestFinished, vi } from 'vitest';
import type { Locator } from 'vitest/browser';
import { expectActivity, renderSolution, within } from '~/tests/utils/render-solution';
import '~/types/jsx';

/**
 * A refused microphone against chromium's fake camera. The browser can't be made to refuse only the microphone here:
 * `--use-fake-ui-for-media-stream` (vitest.config.ts) answers every request, even with the microphone's permission set
 * to denied over CDP, so `getUserMedia` refuses whatever asks for sound and opens the real fake camera otherwise.
 */

const openCamera = async () => {
  const realGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  const microphone = { refused: true };
  const opened: MediaStream[] = [];
  vi.spyOn(navigator.mediaDevices, 'getUserMedia').mockImplementation(async (constraints) => {
    if (constraints?.audio && microphone.refused) throw new DOMException('Permission denied', 'NotAllowedError');
    const stream = await realGetUserMedia(constraints);
    opened.push(stream);
    return stream;
  });
  // The microphone's permission status, for the test to say it changed.
  const microphoneStatus = Object.assign(new EventTarget(), { state: 'denied' });
  const query = navigator.permissions.query.bind(navigator.permissions);
  vi.spyOn(navigator.permissions, 'query').mockImplementation(async (descriptor) =>
    descriptor.name === 'microphone' ? (microphoneStatus as unknown as PermissionStatus) : query(descriptor),
  );
  onTestFinished(() => {
    vi.restoreAllMocks();
    for (const stream of opened) for (const track of stream.getTracks()) track.stop();
  });

  const rendered = await renderSolution('regular');
  rendered.api.initFlow();
  await expectActivity(rendered.root, 'start-from');
  await within(rendered.root).getByTestId('uc-start-from').getByRole('button', { name: 'Camera', exact: true }).click();
  await expectActivity(rendered.root, 'camera');

  const camera = within(rendered.root).getByTestId('uc-camera-source');
  await expect.element(camera.getByTestId('uc-camera-controls--shot'), { timeout: 20_000 }).toBeVisible();
  await camera.getByRole('button', { name: 'Video', exact: true }).click();
  return { camera, microphone, microphoneStatus };
};

const liveStream = (camera: Locator): MediaStream => {
  const stream = camera.element().querySelector('video')?.srcObject;
  if (!(stream instanceof MediaStream)) throw new Error('The camera preview has no stream');
  return stream;
};

const microphoneButton = (camera: Locator) => camera.getByTestId('uc-camera-controls--toggle-microphone');

describe('uc-camera-source with the microphone refused', () => {
  it('opens the camera without sound and crosses out the microphone', async () => {
    const { camera } = await openCamera();

    await expect.element(microphoneButton(camera)).toHaveAccessibleName('Microphone access denied');
    expect(liveStream(camera).getVideoTracks()).toHaveLength(1);
    expect(liveStream(camera).getAudioTracks()).toHaveLength(0);
    await expect.element(camera.getByText('Camera access denied')).not.toBeVisible();
  });

  it('opens the microphone into the camera once its permission is granted, and clears the denial', async () => {
    const { camera, microphone, microphoneStatus } = await openCamera();
    await expect.element(microphoneButton(camera)).toHaveAccessibleName('Microphone access denied');
    const stream = liveStream(camera);

    microphone.refused = false;
    microphoneStatus.state = 'granted';
    microphoneStatus.dispatchEvent(new Event('change'));

    await expect.poll(() => stream.getAudioTracks()[0]?.readyState).toBe('live');
    expect(liveStream(camera)).toBe(stream);
    await expect.element(microphoneButton(camera)).toHaveAccessibleName('Microphone');
  });
});
