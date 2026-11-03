import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Locator } from 'vitest/browser';
import type { Config } from '@/index';
import { delay } from '@/utils/delay';
import { settingOf } from '~/tests/utils/camera-settings';
import { expectActivity, renderSolution, within } from '~/tests/utils/render-solution';
import '~/types/jsx';

/**
 * Regression tests for the bugs found in review. Each asserts the expected behaviour, so it fails until its bug is
 * fixed. Conditions the fake camera can't produce (a slow microphone or camera, a 1080p maximum, a recorder that
 * fails to start, a camera refusing a change) are simulated by wrapping the media APIs.
 */

const realGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const openCamera = async (configProps: Partial<Config> = {}, { video = true } = {}) => {
  const getUserMedia = vi.spyOn(navigator.mediaDevices, 'getUserMedia');
  const rendered = await renderSolution('regular', configProps);
  rendered.api.initFlow();
  await expectActivity(rendered.root, 'start-from');
  await within(rendered.root).getByTestId('uc-start-from').getByRole('button', { name: 'Camera', exact: true }).click();
  await expectActivity(rendered.root, 'camera');
  const camera = within(rendered.root).getByTestId('uc-camera-source');
  await expect.element(camera.getByRole('button', { name: 'Shot', exact: true }), { timeout: 20_000 }).toBeVisible();
  if (video) await camera.getByRole('button', { name: 'Video', exact: true }).click();
  const videoEl = await vi.waitFor(
    () => {
      const el = camera.element().querySelector('video');
      if (!el || el.videoWidth === 0) throw new Error('The camera preview shows no frames yet');
      return el;
    },
    { timeout: 20_000 },
  );
  return {
    ...rendered,
    camera,
    getUserMedia,
    videoEl,
    settingsButton: camera.getByRole('button', { name: 'Camera settings', exact: true, includeHidden: true }),
  };
};

const liveStream = (camera: Locator): MediaStream => {
  const stream = camera.element().querySelector('video')?.srcObject;
  if (!(stream instanceof MediaStream)) throw new Error('The camera preview has no stream');
  return stream;
};
const audioTrack = (camera: Locator) => liveStream(camera).getAudioTracks()[0];
const videoTrack = (camera: Locator) => liveStream(camera).getVideoTracks()[0];

const microphoneRequests = (getUserMedia: { mock: { calls: [MediaStreamConstraints?][] } }) =>
  getUserMedia.mock.calls.map(([c]) => c).filter((c) => c && !c.video);

/** Picks an option in the settings popup the way a user's pick does, without opening it. */
const pickRadio = (camera: Locator, label: string, value: string) => {
  const radio = settingOf(camera, label)
    .radios()
    .find((input) => input.value === value);
  if (!radio) throw new Error(`${label} has no ${value}`);
  radio.checked = true;
  radio.dispatchEvent(new Event('change', { bubbles: true }));
};

/** Records every `MediaRecorder` created, optionally making `start()` throw. */
const captureRecorders = ({ startThrows = false } = {}) => {
  const recorders: MediaRecorder[] = [];
  const Original = window.MediaRecorder;
  vi.stubGlobal(
    'MediaRecorder',
    class extends Original {
      public constructor(stream: MediaStream, init?: MediaRecorderOptions) {
        super(stream, init);
        recorders.push(this);
      }
      public override start(timeslice?: number) {
        if (startThrows) throw new DOMException('Simulated start failure', 'NotSupportedError');
        return super.start(timeslice);
      }
    },
  );
  return recorders;
};

const gate = () => {
  let open!: () => void;
  const closed = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { closed, open };
};

const startRecording = async (camera: Locator) => {
  await camera.getByRole('button', { name: 'Shot', exact: true }).click();
  await expect.element(camera.getByTestId('uc-camera-source--recording-timer')).toBeVisible();
};

describe('camera review bugs', () => {
  it('1: a microphone change that finishes after recording starts waits for the recording to stop', async () => {
    const recorders = captureRecorders();
    const mic = gate();
    const { camera, config, getUserMedia } = await openCamera({ cameraAudioMode: 'voice, music' });
    // Simulated: a slow microphone, still reopening when the user presses record.
    getUserMedia.mockImplementation(async (c) => {
      if (c && !c.video) await mic.closed;
      return realGetUserMedia(c);
    });

    config.cameraAudioMode = 'music';
    await vi.waitFor(() => expect(microphoneRequests(getUserMedia)).toHaveLength(1));
    await startRecording(camera);
    const recorder = recorders[0];
    const errors: string[] = [];
    recorder.addEventListener('error', (e) => errors.push(String((e as ErrorEvent & { error?: Error }).error?.name)));
    mic.open();
    await delay(1000);

    expect(errors).toEqual([]);
    expect(recorder.state).toBe('recording');

    await camera.getByRole('button', { name: 'Shot', exact: true }).click();
    await expect.element(camera.getByRole('button', { name: 'Accept', exact: true })).toBeVisible();
    expect(recorders).toHaveLength(1);
  });

  it('2: after the cameraConstraints fallback, a resolution pick reaches the camera', async () => {
    const { camera, settingsButton } = await openCamera(
      { cameraConstraints: { video: { width: { exact: 12345 } } }, cameraResolution: 'auto, 720p' },
      { video: false },
    );

    await settingsButton.click();
    await settingOf(camera, 'Resolution').pick('720P');

    await vi.waitFor(() => expect(videoTrack(camera).getSettings().height).toBe(720), { timeout: 5000 });
  });

  it('3: the camera runs at the resolution the picker shows', async () => {
    // Simulated: a camera whose maximum is 1080p (the fake one reports 4K).
    const realCaps = MediaStreamTrack.prototype.getCapabilities;
    vi.spyOn(MediaStreamTrack.prototype, 'getCapabilities').mockImplementation(function (this: MediaStreamTrack) {
      const caps = realCaps.call(this);
      return this.kind === 'video'
        ? { ...caps, width: { ...caps.width, max: 1920 }, height: { ...caps.height, max: 1080 } }
        : caps;
    });
    const { camera } = await openCamera({ cameraResolution: '4k, 720p, 1080p' }, { video: false });

    await vi.waitFor(() =>
      expect((settingOf(camera, 'Resolution').option('720P').element() as HTMLInputElement).checked).toBe(true),
    );
    await vi.waitFor(() => expect(videoTrack(camera).getSettings().height).toBe(720), { timeout: 5000 });
  });

  it('4: an aspect-ratio pick made while the camera reopens applies to the reopened camera', async () => {
    const { camera, getUserMedia } = await openCamera({ cameraAspectRatio: 'native, 1:1' }, { video: false });
    const oldTrack = videoTrack(camera);
    // Simulated: a camera that takes a while to reopen.
    const reopen = gate();
    getUserMedia.mockImplementation(async (c) => {
      if (c?.video) await reopen.closed;
      return realGetUserMedia(c);
    });
    const permissions = (camera.element() as unknown as { _permissionResponses: Record<string, PermissionStatus> })
      ._permissionResponses;

    permissions.camera.dispatchEvent(new Event('change')); // a permission change reopens the camera
    await vi.waitFor(() => expect(getUserMedia.mock.calls.filter(([c]) => c?.video).length).toBe(2));
    pickRadio(camera, 'Aspect ratio', '1:1');
    reopen.open();
    await vi.waitFor(() => expect(videoTrack(camera)).not.toBe(oldTrack), { timeout: 10_000 });

    await vi.waitFor(
      () => {
        const { width = 0, height = 1 } = videoTrack(camera).getSettings();
        expect(width / height).toBeCloseTo(1, 2);
      },
      { timeout: 5000 },
    );
  });

  it('5: when recording fails to start, the canvas stops drawing', async () => {
    // Simulated: MediaRecorder.start() fails, e.g. for a codec the browser can't record from a canvas.
    captureRecorders({ startThrows: true });
    const draw = vi.spyOn(CanvasRenderingContext2D.prototype, 'drawImage');
    const error = vi.spyOn(console, 'error');
    const { camera } = await openCamera({ cameraMirror: true });

    await camera.getByRole('button', { name: 'Shot', exact: true }).click();
    await vi.waitFor(() => expect(error.mock.calls.some(([m]) => m === 'Failed to start recording')).toBe(true));
    const drawsAtFailure = draw.mock.calls.length;
    await delay(1000);

    expect(draw.mock.calls.length - drawsAtFailure).toBeLessThanOrEqual(1);
  });

  it('6: the recording crop follows a frame size change mid-recording', async () => {
    const draw = vi.spyOn(CanvasRenderingContext2D.prototype, 'drawImage');
    const { camera, videoEl } = await openCamera({ cameraAspectRatio: '1:1', cameraMirror: true });
    await startRecording(camera);

    // As turning a phone changes the frame size.
    await videoTrack(camera).applyConstraints({ width: { exact: 640 }, height: { exact: 480 } });
    await vi.waitFor(() => expect(videoEl.videoWidth).toBe(640), { timeout: 10_000 });

    await vi.waitFor(() => {
      const [, sx, sy, sw, sh] = draw.mock.lastCall as unknown as [unknown, number, number, number, number];
      expect(sx + sw).toBeLessThanOrEqual(videoEl.videoWidth);
      expect(sy + sh).toBeLessThanOrEqual(videoEl.videoHeight);
      expect(sw / sh).toBeCloseTo(1, 2);
    });
  });

  it('8: an empty camera-photo-quality keeps the default quality', async () => {
    const toBlob = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob');
    const { camera, config } = await openCamera({}, { video: false });
    config.setAttribute('camera-photo-quality', '');
    await delay(100); // the attribute reaches the config asynchronously

    await camera.getByRole('button', { name: 'Shot', exact: true }).click();
    await vi.waitFor(() => expect(toBlob).toHaveBeenCalled());

    expect(toBlob.mock.lastCall?.[2]).toBe(0.92);
  });

  it('9: cameraConstraints { audio: false } is rejected or keeps the microphone closed', async () => {
    const error = vi.spyOn(console, 'error');
    const { camera } = await openCamera({
      cameraConstraints: { audio: false } as unknown as Config['cameraConstraints'],
    });

    const rejected = error.mock.calls.some(([m]) => String(m).includes('cameraConstraints'));
    expect(rejected || audioTrack(camera) === undefined).toBe(true);
  });

  it('10: a failed resolution pick does not blame cameraConstraints when none are set', async () => {
    const warn = vi.spyOn(console, 'warn');
    const { camera, settingsButton } = await openCamera({ cameraResolution: 'auto, 720p' }, { video: false });
    // Simulated: the camera refuses the change.
    vi.spyOn(MediaStreamTrack.prototype, 'applyConstraints').mockRejectedValue(
      new DOMException('Simulated refusal', 'OverconstrainedError'),
    );

    await settingsButton.click();
    await settingOf(camera, 'Resolution').pick('720P');
    await vi.waitFor(() => expect(warn).toHaveBeenCalled());

    expect(String(warn.mock.lastCall?.[0])).not.toContain('cameraConstraints');
  });
});
