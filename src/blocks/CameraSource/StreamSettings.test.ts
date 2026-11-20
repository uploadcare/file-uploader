import { afterEach, describe, expect, it, vi } from 'vitest';
import { cameraConfig, cameraTasks, fakeStream, fakeTrack } from './__tests__/camera-fixtures';
import { StreamSettings } from './StreamSettings';

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Stream settings over an open camera with a microphone, and a recording the test turns on and off. */
const setup = async () => {
  const video = fakeTrack('video', 'cam-1');
  const getUserMedia = vi.fn(async (constraints: MediaStreamConstraints) =>
    fakeStream(constraints.video ? [video, fakeTrack('audio', 'mic-1')] : [fakeTrack('audio', 'mic-2')]),
  );
  const mediaDevices = Object.assign(new EventTarget(), { getUserMedia, enumerateDevices: vi.fn(async () => []) });
  vi.stubGlobal('navigator', { ...navigator, mediaDevices });
  const state = { recording: false };
  const stream = new StreamSettings({
    ...cameraTasks(),
    config: cameraConfig({ cameraResolution: 'auto' }),
    mode: () => 'video',
    isRecording: () => state.recording,
    cameraLabel: () => 'Camera',
    microphoneLabel: () => 'Microphone',
    report: vi.fn(),
  });
  await stream.open(() => {});
  const microphoneCalls = () => getUserMedia.mock.calls.filter(([constraints]) => !constraints.video);
  return { stream, state, video, microphoneCalls };
};

describe('StreamSettings while recording', () => {
  it('holds a change back until resume, then applies it once', async () => {
    const { stream, state, video, microphoneCalls } = await setup();
    state.recording = true;

    stream.settings.pick('aspectRatio', '1:1');
    stream.apply('aspectRatio');
    stream.selectMicrophone('mic-2');
    expect(video.applyConstraints).not.toHaveBeenCalled();
    expect(microphoneCalls()).toHaveLength(0);

    state.recording = false;
    stream.resume();
    stream.resume();

    expect(video.applyConstraints).toHaveBeenCalledOnce();
    expect(microphoneCalls()).toHaveLength(1);
  });

  it('asks nothing of the camera on a resume with no change held back', async () => {
    const { stream, video, microphoneCalls } = await setup();

    stream.resume();

    expect(video.applyConstraints).not.toHaveBeenCalled();
    expect(microphoneCalls()).toHaveLength(0);
  });

  it('starts from the picks, the devices and the refused microphone of the session before', async () => {
    const { stream } = await setup();
    stream.settings.pick('aspectRatio', '1:1');
    stream.devices.adopt({ cameras: [{ text: 'Camera', value: 'cam-1' }], microphones: [] }, null);
    stream.microphoneDenied = true;

    const next = (await setup()).stream;
    next.keep(stream);

    expect(next.settings.aspectRatioChoice).toBe('1:1');
    expect([next.devices.cameras, next.devices.selectedCameraId]).toEqual([stream.devices.cameras, 'cam-1']);
    expect(next.microphoneDenied).toBe(true);
  });
});
