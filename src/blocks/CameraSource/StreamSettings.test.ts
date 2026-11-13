import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeStream, fakeTrack, lifetimeOf } from './__tests__/camera-fixtures';
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
    lifetime: lifetimeOf(),
    config: {
      audioEnabled: () => true,
      constraints: () => null,
      aspectRatio: () => 'native, 1:1',
      resolution: () => 'auto',
      audioQuality: () => 'auto',
      audioMode: () => 'voice',
    },
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

  it('forgets the changes held back for a recording that ended without a stop', async () => {
    const { stream, state, video } = await setup();
    state.recording = true;
    stream.settings.pick('aspectRatio', '1:1');
    stream.apply('aspectRatio');

    state.recording = false;
    stream.forgetDeferred();
    stream.resume();

    expect(video.applyConstraints).not.toHaveBeenCalled();
  });
});
