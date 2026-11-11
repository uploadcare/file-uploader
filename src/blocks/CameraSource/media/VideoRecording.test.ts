import { afterEach, describe, expect, it, vi } from 'vitest';
import { Lifetime } from '../../../abstract/di/Lifetime';
import { delay } from '../../../utils/delay';
import { FakeRecorder } from '../__tests__/camera-fixtures';
import { createRecordingSource } from './recordingSource';
import { type Clip, recorderOptions, VideoRecording } from './VideoRecording';

vi.mock('./recordingSource', () => ({ createRecordingSource: vi.fn() }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(createRecordingSource).mockReset();
});

const startRecording = (recording: VideoRecording) => {
  recording.start(new EventTarget() as unknown as MediaStream, undefined, {
    aspectRatio: null,
    mirror: false,
    recorder: {},
  });
  return FakeRecorder.last;
};

describe('VideoRecording.stop', () => {
  it('stop resolves after the final stop event', async () => {
    vi.stubGlobal('MediaRecorder', FakeRecorder);
    const recording = new VideoRecording();
    const recorder = startRecording(recording);
    recorder.dispatchEvent(Object.assign(new Event('dataavailable'), { data: new Blob(['clip']) }));
    const stopped = vi.fn();
    const clip = recording.stop().then(stopped);
    await delay(0);
    expect(stopped).not.toHaveBeenCalled();

    recorder.dispatchEvent(new Event('stop'));
    await clip;

    const [{ blob, mimeType }] = stopped.mock.lastCall as [Clip];
    expect([blob.size, blob.type, mimeType]).toEqual([4, 'video/webm', 'video/webm']);
  });

  it('stops the canvas on the final stop event, before the clip carries its mirroring out', async () => {
    vi.stubGlobal('MediaRecorder', FakeRecorder);
    const stop = vi.fn();
    vi.mocked(createRecordingSource).mockReturnValue({
      stream: new EventTarget() as MediaStream,
      mirrored: true,
      stop,
    });
    const recording = new VideoRecording();
    recording.start(new EventTarget() as unknown as MediaStream, {} as HTMLVideoElement, {
      aspectRatio: null,
      mirror: true,
      recorder: {},
    });
    const recorder = FakeRecorder.last;
    const clip = recording.stop();
    expect(stop).not.toHaveBeenCalled();

    recorder.dispatchEvent(new Event('stop'));
    expect(stop).toHaveBeenCalledOnce();
    expect((await clip)?.mirrored).toBe(true);
    recording.releaseSource();
    expect(stop).toHaveBeenCalledOnce();
  });

  it('is stopping from the stop until the final stop event', async () => {
    vi.stubGlobal('MediaRecorder', FakeRecorder);
    const recording = new VideoRecording();
    const recorder = startRecording(recording);
    const clip = recording.stop();
    expect([recording.isRecording, recording.isStopping]).toEqual([false, true]);

    recorder.dispatchEvent(new Event('stop'));
    await clip;
    expect(recording.isStopping).toBe(false);
  });

  it('hands over no clip for a recording discarded before its final stop event', async () => {
    vi.stubGlobal('MediaRecorder', FakeRecorder);
    const recording = new VideoRecording();
    const recorder = startRecording(recording);
    recorder.dispatchEvent(Object.assign(new Event('dataavailable'), { data: new Blob(['clip']) }));
    const clip = recording.stop();

    recording.discard();
    expect(recording.isStopping).toBe(false);
    recorder.dispatchEvent(new Event('stop'));

    expect(await clip).toBeNull();
  });

  it('a stop that arrives after the adoption ended does nothing', async () => {
    vi.stubGlobal('MediaRecorder', FakeRecorder);
    const recording = new VideoRecording();
    const recorder = startRecording(recording);
    const adoption = new Lifetime();
    const onStopped = vi.fn();
    const taskFailed = vi.fn();
    adoption.run(async () => {
      await adoption.guard(recording.stop());
      onStopped();
    }, taskFailed);

    adoption.end();
    recorder.dispatchEvent(new Event('stop'));
    await delay(0);

    expect(onStopped).not.toHaveBeenCalled();
    expect(taskFailed).not.toHaveBeenCalled();
  });
});

describe('VideoRecording chunks', () => {
  it('keeps a late chunk from a discarded recording out of the next one', async () => {
    vi.stubGlobal('MediaRecorder', FakeRecorder);
    const recording = new VideoRecording();
    const first = startRecording(recording);
    recording.discard();
    const second = startRecording(recording);
    first.dispatchEvent(Object.assign(new Event('dataavailable'), { data: new Blob(['late']) }));
    const clip = recording.stop();
    second.dispatchEvent(new Event('stop'));
    expect((await clip)?.blob.size).toBe(0);
  });
});

describe('VideoRecording.discard', () => {
  it('stops the recording canvas, so the next recording starts without the first still drawing', () => {
    vi.stubGlobal('MediaRecorder', FakeRecorder);
    const first = vi.fn();
    const second = vi.fn();
    vi.mocked(createRecordingSource)
      .mockReturnValueOnce({ stream: new EventTarget() as MediaStream, mirrored: false, stop: first })
      .mockReturnValueOnce({ stream: new EventTarget() as MediaStream, mirrored: false, stop: second });
    const recording = new VideoRecording();
    const start = () =>
      recording.start(new EventTarget() as unknown as MediaStream, {} as HTMLVideoElement, {
        aspectRatio: null,
        mirror: false,
        recorder: {},
      });

    start();
    recording.discard();
    expect(first).toHaveBeenCalledOnce();

    start();
    recording.discard();
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
  });
});

describe('recorderOptions', () => {
  it('recorderOptions drops an unsupported mimeType', () => {
    vi.stubGlobal('MediaRecorder', { isTypeSupported: () => false });
    expect(recorderOptions({ mimeType: 'video/bogus', videoBitsPerSecond: 1 }, 'auto', 'webm')).toEqual({
      videoBitsPerSecond: 1,
    });
  });

  it('picks a supported format and the audio bitrate', () => {
    vi.stubGlobal('MediaRecorder', { isTypeSupported: (type: string) => type === 'video/mp4' });
    expect(recorderOptions(null, 'high', 'webm, mp4')).toEqual({
      audioBitsPerSecond: expect.any(Number),
      mimeType: 'video/mp4',
    });
  });
});

describe('VideoRecording.start failure', () => {
  it('stops the canvas before the throw, once', () => {
    const error = new Error('Simulated');
    vi.stubGlobal(
      'MediaRecorder',
      class extends FakeRecorder {
        public override start(): void {
          throw error;
        }
      },
    );
    const stop = vi.fn();
    vi.mocked(createRecordingSource).mockReturnValue({
      stream: new EventTarget() as MediaStream,
      mirrored: true,
      stop,
    });
    const recording = new VideoRecording();

    expect(() =>
      recording.start(new EventTarget() as unknown as MediaStream, {} as HTMLVideoElement, {
        aspectRatio: null,
        mirror: true,
        recorder: {},
      }),
    ).toThrow(error);
    expect(stop).toHaveBeenCalledOnce();

    recording.releaseSource();
    expect(stop).toHaveBeenCalledOnce();
  });
});
