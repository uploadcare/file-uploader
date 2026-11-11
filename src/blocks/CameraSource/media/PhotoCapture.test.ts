import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubCanvas } from '../__tests__/camera-fixtures';
import { PhotoCapture, photoFile } from './PhotoCapture';

afterEach(() => {
  vi.restoreAllMocks();
});

const video = { videoWidth: 640, videoHeight: 480 } as HTMLVideoElement;
const options = { aspectRatio: null, mirror: false, quality: 0.9 };

describe('PhotoCapture', () => {
  it('take draws before it returns', async () => {
    const { drawImage, encode } = stubCanvas(() => {});
    const photo = new PhotoCapture();

    photo.take(video, options);
    expect(drawImage).toHaveBeenCalledOnce();

    const jpeg = new Blob(['jpeg']);
    encode(jpeg);
    await expect(photo.claim()).resolves.toBe(jpeg);
    expect(photo.claim()).toBeNull();
  });

  it('discard drops the shot', () => {
    stubCanvas(() => {});
    const photo = new PhotoCapture();
    photo.take(video, options);
    photo.discard();
    expect(photo.claim()).toBeNull();
  });
});

describe('photoFile', () => {
  it('photoFile names the file at call time', () => {
    vi.spyOn(Date, 'now').mockReturnValue(2000);
    const file = photoFile(new Blob(['jpeg']));
    expect([file.name, file.type, file.lastModified]).toEqual(['camera-2000.jpeg', 'image/jpeg', 2000]);
  });
});
