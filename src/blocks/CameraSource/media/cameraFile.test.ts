import { describe, expect, it, vi } from 'vitest';
import { createCameraFile, guessExtensionByMime } from './cameraFile';

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
