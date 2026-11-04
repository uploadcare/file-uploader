import { describe, expect, it, vi } from 'vitest';
import type { Locator } from 'vitest/browser';
import type { Config } from '@/index';
import { settingOf } from '~/tests/utils/camera-settings';
import { expectActivity, renderSolution, within } from '~/tests/utils/render-solution';
import '~/types/jsx';

/**
 * `cameraAudioMode`, `cameraAudioQuality` and their pickers against chromium's fake microphone
 * (`--use-fake-device-for-media-stream`), which supports stereo and lets processing be turned off.
 */

const MUSIC = {
  echoCancellation: { ideal: false },
  noiseSuppression: { ideal: false },
  autoGainControl: { ideal: false },
  channelCount: { ideal: 2 },
};

/** A swap keeps the microphone in use: the device list has picked it by then. */
const MUSIC_ON_THE_SAME_MIC = { ...MUSIC, deviceId: { exact: expect.any(String) } };

const openCamera = async (configProps: Partial<Config> = {}) => {
  const getUserMedia = vi.spyOn(navigator.mediaDevices, 'getUserMedia');

  const rendered = await renderSolution('regular', configProps);
  rendered.api.initFlow();
  await expectActivity(rendered.root, 'start-from');
  await within(rendered.root).getByTestId('uc-start-from').getByRole('button', { name: 'Camera', exact: true }).click();
  await expectActivity(rendered.root, 'camera');

  const camera = within(rendered.root).getByTestId('uc-camera-source');
  await expect.element(camera.getByRole('button', { name: 'Shot', exact: true }), { timeout: 20_000 }).toBeVisible();
  await camera.getByRole('button', { name: 'Video', exact: true }).click();

  return {
    ...rendered,
    camera,
    getUserMedia,
    settingsButton: camera.getByRole('button', { name: 'Camera settings', exact: true, includeHidden: true }),
    audioQuality: settingOf(camera, 'Audio quality'),
    audioMode: settingOf(camera, 'Sound'),
    microphone: settingOf(camera, 'Microphone'),
  };
};

/** The stream the preview shows, which is also the one recorded. */
const liveStream = (camera: Locator): MediaStream => {
  const stream = camera.element().querySelector('video')?.srcObject;
  if (!(stream instanceof MediaStream)) throw new Error('The camera preview has no stream');
  return stream;
};

const audioTrack = (camera: Locator) => liveStream(camera).getAudioTracks()[0];
const videoTrack = (camera: Locator) => liveStream(camera).getVideoTracks()[0];

/** Picks a microphone in the settings popup without opening it, as a user's pick would. */
const pickMicrophone = (camera: Locator, deviceId: string) => {
  const radio = settingOf(camera, 'Microphone')
    .radios()
    .find((input) => input.value === deviceId);
  if (!radio) throw new Error(`The microphone picker has no ${deviceId}`);
  radio.checked = true;
  radio.dispatchEvent(new Event('change', { bubbles: true }));
};

/** Microphone-only requests: what a swap asks for, as opposed to opening the camera. */
const microphoneRequests = (getUserMedia: Awaited<ReturnType<typeof openCamera>>['getUserMedia']) =>
  getUserMedia.mock.calls
    .map(([constraints]) => constraints)
    .filter((constraints) => constraints && !constraints.video);

/** The options every recorder is created with, by wrapping the real `MediaRecorder`. */
const spyOnRecorderOptions = () => {
  const options: (MediaRecorderOptions | undefined)[] = [];
  const Original = window.MediaRecorder;
  vi.stubGlobal(
    'MediaRecorder',
    class extends Original {
      public constructor(stream: MediaStream, init?: MediaRecorderOptions) {
        super(stream, init);
        options.push(init);
      }
    },
  );
  return options;
};

const startRecording = async (camera: Locator) => {
  await camera.getByRole('button', { name: 'Shot', exact: true }).click();
  await expect.element(camera.getByTestId('uc-camera-source--recording-timer')).toBeVisible();
};

describe('cameraAudioMode', () => {
  it('keeps the browser voice defaults', async () => {
    const { camera, getUserMedia } = await openCamera();

    expect(getUserMedia.mock.lastCall?.[0]?.audio).toEqual({});
    expect(audioTrack(camera)?.getSettings()).toMatchObject({ echoCancellation: true, noiseSuppression: true });
  });

  it('opens a stereo microphone without processing for music', async () => {
    const { camera, getUserMedia } = await openCamera({ cameraAudioMode: 'music' });

    expect(getUserMedia.mock.lastCall?.[0]?.audio).toEqual(MUSIC);
    expect(audioTrack(camera)?.getSettings()).toMatchObject({ channelCount: 2, echoCancellation: false });
  });

  it('applies the first item of a list until the user picks', async () => {
    const { camera, getUserMedia } = await openCamera({ cameraAudioMode: 'music, voice' });

    expect(getUserMedia.mock.lastCall?.[0]?.audio).toEqual(MUSIC);
    expect(audioTrack(camera)?.getSettings().channelCount).toBe(2);
  });

  it('applies a change by reopening only the microphone', async () => {
    const { camera, config, getUserMedia } = await openCamera();
    const camTrack = videoTrack(camera);
    const oldMic = audioTrack(camera);

    config.cameraAudioMode = 'music';

    await vi.waitFor(() => expect(audioTrack(camera)).not.toBe(oldMic), { timeout: 10_000 });
    expect(microphoneRequests(getUserMedia)).toEqual([{ audio: MUSIC_ON_THE_SAME_MIC }]);
    expect(videoTrack(camera)).toBe(camTrack);
    expect(oldMic?.readyState).toBe('ended');
    expect(audioTrack(camera)?.getSettings().channelCount).toBe(2);
  });

  it('keeps a muted microphone muted across a change', async () => {
    const { camera, config } = await openCamera();
    await camera.getByTestId('uc-camera-source--toggle-microphone').click();
    const oldMic = audioTrack(camera);
    expect(oldMic?.enabled).toBe(false);

    config.cameraAudioMode = 'music';

    await vi.waitFor(() => expect(audioTrack(camera)).not.toBe(oldMic), { timeout: 10_000 });
    expect(audioTrack(camera)?.enabled).toBe(false);
  });

  it('waits for a recording to stop before applying a change', async () => {
    const { camera, config, getUserMedia } = await openCamera();
    await startRecording(camera);

    config.cameraAudioMode = 'music';
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(microphoneRequests(getUserMedia)).toEqual([]);

    await camera.getByRole('button', { name: 'Shot', exact: true }).click();

    await vi.waitFor(() => expect(microphoneRequests(getUserMedia)).toEqual([{ audio: MUSIC_ON_THE_SAME_MIC }]), {
      timeout: 10_000,
    });
  });

  it('does nothing when the microphone in use is picked again', async () => {
    const { camera, getUserMedia } = await openCamera();

    pickMicrophone(camera, audioTrack(camera)?.getSettings().deviceId ?? '');

    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(microphoneRequests(getUserMedia)).toEqual([]);
  });

  it('switches to another microphone without reopening the camera', async () => {
    const { camera, getUserMedia } = await openCamera();
    const camTrack = videoTrack(camera);
    const inUse = audioTrack(camera)?.getSettings().deviceId;
    const other = settingOf(camera, 'Microphone')
      .radios()
      .find((radio) => radio.value !== inUse)?.value;
    if (!other) throw new Error('The fake device offers a single microphone');

    pickMicrophone(camera, other);

    await vi.waitFor(() =>
      expect(microphoneRequests(getUserMedia)).toEqual([{ audio: { deviceId: { exact: other } } }]),
    );
    expect(videoTrack(camera)).toBe(camTrack);
  });
});

describe('cameraAudioQuality', () => {
  it('leaves the bitrate to the browser by default', async () => {
    const options = spyOnRecorderOptions();
    const { camera } = await openCamera();

    await startRecording(camera);

    expect(options.at(-1)?.audioBitsPerSecond).toBeUndefined();
  });

  it('records at the preset bitrate', async () => {
    const options = spyOnRecorderOptions();
    const { camera } = await openCamera({ cameraAudioQuality: 'high' });

    await startRecording(camera);

    expect(options.at(-1)?.audioBitsPerSecond).toBe(192_000);
  });

  it('lets an explicit mediaRecorderOptions bitrate win', async () => {
    const options = spyOnRecorderOptions();
    const { camera } = await openCamera({
      cameraAudioQuality: 'high',
      mediaRecorderOptions: { audioBitsPerSecond: 48_000 },
    });

    await startRecording(camera);

    expect(options.at(-1)?.audioBitsPerSecond).toBe(48_000);
  });
});

describe('audio pickers', () => {
  const PICKERS: Partial<Config> = {
    cameraAudioQuality: 'auto, low, high',
    cameraAudioMode: 'voice, music',
  };

  it('are offered in video mode, labelled', async () => {
    const opened = await openCamera(PICKERS);

    await opened.settingsButton.click();

    await expect.element(opened.audioQuality.row).toBeVisible();
    await expect.element(opened.audioMode.row).toBeVisible();
    expect(opened.audioQuality.texts()).toEqual(['Auto', 'Low', 'High']);
    expect(opened.audioMode.texts()).toEqual(['Voice', 'Music']);
  });

  it('are not offered in photo mode', async () => {
    const opened = await openCamera(PICKERS);

    await opened.camera.getByRole('button', { name: 'Photo', exact: true }).click();

    await expect.element(opened.settingsButton).not.toBeVisible();
  });

  it('are not offered without audio recording', async () => {
    const opened = await openCamera({ ...PICKERS, enableAudioRecording: false });

    await expect.element(opened.settingsButton).not.toBeVisible();
  });

  it('apply the picks without changing the config', async () => {
    const options = spyOnRecorderOptions();
    const opened = await openCamera(PICKERS);
    await opened.settingsButton.click();

    await opened.audioMode.pick('Music');
    await opened.audioQuality.pick('Low');
    await vi.waitFor(() => expect(microphoneRequests(opened.getUserMedia)).toEqual([{ audio: MUSIC_ON_THE_SAME_MIC }]));
    await opened.settingsButton.click();
    await startRecording(opened.camera);

    expect(options.at(-1)?.audioBitsPerSecond).toBe(32_000);
    expect(opened.config.cameraAudioMode).toBe('voice, music');
    expect(opened.config.cameraAudioQuality).toBe('auto, low, high');
  });
});

describe('microphone picker', () => {
  it('lists the microphones in the settings, without any config', async () => {
    const opened = await openCamera();

    await opened.settingsButton.click();

    // The only setting here, so the popup shows its options without a heading.
    await expect.element(opened.microphone.options).toBeVisible();
    const radios = opened.microphone.radios();
    expect(radios.length).toBeGreaterThan(1);
    expect(radios.find((radio) => radio.checked)?.value).toBe(audioTrack(opened.camera)?.getSettings().deviceId);
    // Moved, not duplicated: outside the settings popup, the bottom bar has no picker, only the mute button.
    const barPickers = [
      ...opened.camera.element().querySelectorAll('.uc-controls uc-select, .uc-controls [role="radiogroup"]'),
    ].filter((picker) => !picker.closest('[popover]'));
    expect(barPickers).toEqual([]);
    await expect.element(opened.camera.getByTestId('uc-camera-source--toggle-microphone')).toBeVisible();
  });

  it('switches microphones without reopening the camera', async () => {
    const opened = await openCamera();
    const camTrack = videoTrack(opened.camera);
    const inUse = audioTrack(opened.camera)?.getSettings().deviceId;
    await opened.settingsButton.click();
    const other = opened.microphone.radios().find((radio) => radio.value !== inUse);
    const otherText = other?.labels?.[0]?.textContent?.trim();
    if (!other || !otherText) throw new Error('The fake device offers a single microphone');

    await opened.microphone.pick(otherText);

    await vi.waitFor(() =>
      expect(microphoneRequests(opened.getUserMedia)).toEqual([{ audio: { deviceId: { exact: other.value } } }]),
    );
    expect(videoTrack(opened.camera)).toBe(camTrack);
  });

  it('is disabled while the microphone is muted, open if it is the only setting', async () => {
    const opened = await openCamera();
    await opened.camera.getByTestId('uc-camera-source--toggle-microphone').click();

    await opened.settingsButton.click();

    await expect.poll(() => opened.microphone.radios().every((radio) => radio.disabled)).toBe(true);
    expect(opened.microphone.isOpen()).toBe(true);
  });

  it('shuts its whole section while the microphone is muted, and keeps it shut', async () => {
    const opened = await openCamera({ cameraAudioQuality: 'auto, low, high' });
    await opened.settingsButton.click();
    if (!opened.microphone.isOpen()) await opened.microphone.row.click();
    await expect.poll(() => opened.microphone.isOpen()).toBe(true);

    // The click outside also dismisses the popup.
    await opened.camera.getByTestId('uc-camera-source--toggle-microphone').click();
    await opened.settingsButton.click();

    const summary = opened.microphone.options.element().closest('details')?.querySelector('summary');
    await expect.poll(() => summary?.getAttribute('aria-disabled')).toBe('true');
    expect(opened.microphone.isOpen()).toBe(false);
    await opened.microphone.row.click();
    expect(opened.microphone.isOpen()).toBe(false);
  });

  it('is not offered in photo mode', async () => {
    const opened = await openCamera();

    await opened.camera.getByRole('button', { name: 'Photo', exact: true }).click();

    await expect.element(opened.settingsButton).not.toBeVisible();
  });
});
