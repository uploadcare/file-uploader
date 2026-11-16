import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeRecorder, stubCanvas } from '../__tests__/camera-fixtures';
import { Capture } from './Capture';

const clip = { blob: new Blob(['clip']), mimeType: 'video/x-matroska;codecs=avc1', mirrored: false };
const video = { videoWidth: 640, videoHeight: 480 } as HTMLVideoElement;
const photoOptions = { aspectRatio: null, mirror: false, quality: 0.9 };

beforeEach(() => {
  let next = 0;
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:${++next}`);
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.stubGlobal('MediaRecorder', FakeRecorder);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const onEnd = () => {};

const record = (capture: Capture) => {
  capture.record(
    new EventTarget() as unknown as MediaStream,
    undefined,
    { aspectRatio: null, mirror: false, recorder: {} },
    onEnd,
  );
  return FakeRecorder.last;
};

describe('Capture photo', () => {
  it('shoot draws before it returns, and holds the photo until the capture ends', async () => {
    const { drawImage, encode } = stubCanvas(() => {});
    const capture = new Capture();

    capture.shoot(video, photoOptions);
    expect(drawImage).toHaveBeenCalledOnce();
    expect(capture.phase).toBe('shot');

    const jpeg = new Blob(['jpeg']);
    encode(jpeg);
    await expect(capture.photo).resolves.toBe(jpeg);

    capture.end();
    expect([capture.photo, capture.phase]).toEqual([null, 'live']);
  });
});

describe('Capture recording', () => {
  it('is stopping from the stop until the clip is handed over, and shows as recording meanwhile', async () => {
    const capture = new Capture();
    const recorder = record(capture);
    expect([capture.phase, capture.isRecording, capture.isStopping]).toEqual(['recording', true, false]);

    const stopped = capture.stop();
    expect([capture.phase, capture.isRecording, capture.isStopping]).toEqual(['recording', false, true]);

    recorder.dispatchEvent(new Event('stop'));
    const handed = await stopped;
    expect(handed?.mimeType).toBe('video/webm');
    if (handed) capture.review(handed);
    expect([capture.phase, capture.isStopping]).toEqual(['recorded', false]);
  });

  it('resolves with no clip when nothing is recording, and stays live', async () => {
    const capture = new Capture();
    await expect(capture.stop()).resolves.toBeNull();
    expect([capture.phase, capture.isStopping]).toEqual(['live', false]);
  });

  it('hands over no clip for a recording ended before its final stop event', async () => {
    const capture = new Capture();
    const recorder = record(capture);
    const stopped = capture.stop();

    capture.end();
    expect([capture.phase, capture.isStopping]).toEqual(['live', false]);
    recorder.dispatchEvent(new Event('stop'));

    expect(await stopped).toBeNull();
  });

  it('a recording abandoned with its camera ends at once, without a clip', () => {
    const capture = new Capture();
    const recorder = record(capture);

    capture.abandon();

    expect(recorder.stop).toHaveBeenCalledOnce();
    expect([capture.phase, capture.isRecording, capture.isStopping]).toEqual(['live', false, false]);
  });

  it('a stopping recorder abandoned with its camera shows live, and drops its clip as it arrives', async () => {
    const capture = new Capture();
    const recorder = record(capture);
    const stopped = capture.stop();

    capture.abandon();
    expect([capture.phase, capture.isStopping]).toEqual(['live', true]);

    recorder.dispatchEvent(new Event('stop'));
    expect(await stopped).toBeNull();
    expect([capture.phase, capture.isStopping]).toEqual(['live', false]);
  });

  it('a recorder that ended on its own hands over what it recorded when stopped', async () => {
    const capture = new Capture();
    const recorder = record(capture);
    recorder.dispatchEvent(Object.assign(new Event('dataavailable'), { data: new Blob(['clip']) }));

    recorder.state = 'inactive';
    expect(capture.isRecording).toBe(true);

    expect((await capture.stop())?.blob.size).toBe(4);
    expect(recorder.stop).not.toHaveBeenCalled();
  });

  it('a recorder that cannot start leaves the capture live', () => {
    vi.spyOn(FakeRecorder.prototype, 'start').mockImplementation(() => {
      throw new Error('Simulated');
    });
    const capture = new Capture();

    expect(() => record(capture)).toThrow('Simulated');
    expect(capture.phase).toBe('live');
  });
});

describe('Capture review', () => {
  it('review revokes the previous URL', () => {
    const capture = new Capture();
    expect(capture.review(clip)).toBe('blob:1');
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();

    expect(capture.review(clip)).toBe('blob:2');
    expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:1');
  });

  it('clipFile makes the file at call time', () => {
    const capture = new Capture();
    const date = vi.spyOn(Date, 'now').mockReturnValue(1000);
    capture.review(clip);

    date.mockReturnValue(2000);
    const file = capture.clipFile();

    expect([file?.name, file?.type, file?.lastModified]).toEqual(['video-2000.mkv', 'video/x-matroska', 2000]);
  });

  it('end revokes the URL, forgets the clip and drops the mirroring', () => {
    const capture = new Capture();
    capture.review({ ...clip, mirrored: true });
    expect(capture.playbackMirrored).toBe(true);

    capture.end();
    capture.end();

    expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:1');
    expect([capture.clipFile(), capture.playbackMirrored, capture.phase]).toEqual([null, false, 'live']);
  });

  it('a clip whose URL cannot be made is under review all the same, the preview left as it mirrors', () => {
    vi.mocked(URL.createObjectURL).mockImplementation(() => {
      throw new Error('Simulated');
    });
    const capture = new Capture();

    expect(() => capture.review({ ...clip, mirrored: true })).toThrow('Simulated');

    expect([capture.phase, capture.playbackMirrored]).toEqual(['recorded', false]);
    expect(capture.clipFile()).not.toBeNull();
  });

  it('the icon follows playback', () => {
    const capture = new Capture();
    capture.playing(true);
    expect(capture.timelineIcon).toBe('pause');
    capture.playing(false);
    expect(capture.timelineIcon).toBe('play');
  });
});
