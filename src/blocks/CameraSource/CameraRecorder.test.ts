import { afterEach, describe, expect, it, vi } from 'vitest';
import { CameraRecorder, createCameraFile, formatTime, guessExtensionByMime } from './CameraRecorder';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('guessExtensionByMime', () => {
  it.each([
    ['video/webm;codecs=vp9', 'webm'],
    ['video/mp4', 'mp4'],
    ['video/quicktime', 'mov'],
    ['video/x-matroska;codecs=avc1,opus', 'mkv'],
    ['', 'webm'],
    ['video/unknown', 'avi'],
    ['audio/ogg', 'avi'],
    [undefined, 'avi'],
  ])('%s → %s', (mime, ext) => {
    expect(guessExtensionByMime(mime)).toBe(ext);
  });
});

describe('formatTime', () => {
  it('formats minutes and seconds', () => {
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(65.9)).toBe('01:05');
  });
});

describe('createCameraFile', () => {
  it('names the file after its kind and the time', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000);
    const file = createCameraFile('video', 'webm', 'video/webm', new Blob(['x']));
    expect([file.name, file.type, file.lastModified]).toEqual([
      'video-1700000000000.webm',
      'video/webm',
      1700000000000,
    ]);
  });
});

class FakeRecorder extends EventTarget {
  public static last: FakeRecorder;
  public state: RecordingState = 'inactive';
  public mimeType = 'video/webm';
  public constructor() {
    super();
    FakeRecorder.last = this;
  }
  public start(): void {
    this.state = 'recording';
  }
  public stop(): void {
    this.state = 'inactive';
  }
}

describe('CameraRecorder.stop after release', () => {
  it('drops a stop event that arrives after the adoption ended', () => {
    vi.stubGlobal('MediaRecorder', FakeRecorder);
    const recorder = new CameraRecorder();
    recorder.start(new EventTarget() as unknown as MediaStream);
    const fake = FakeRecorder.last;
    const onStopped = vi.fn();
    const adoption = new AbortController();
    recorder.stop(onStopped, adoption.signal);
    adoption.abort();
    fake.dispatchEvent(new Event('stop'));
    expect(onStopped).not.toHaveBeenCalled();
  });
});

describe('CameraRecorder chunks', () => {
  it('keeps a late chunk from a discarded recording out of the next one', () => {
    vi.stubGlobal('MediaRecorder', FakeRecorder);
    const recorder = new CameraRecorder();
    recorder.start(new EventTarget() as unknown as MediaStream);
    const first = FakeRecorder.last;
    recorder.discard();
    recorder.start(new EventTarget() as unknown as MediaStream);
    first.dispatchEvent(Object.assign(new Event('dataavailable'), { data: new Blob(['late']) }));
    expect(recorder.clip().size).toBe(0);
  });
});
