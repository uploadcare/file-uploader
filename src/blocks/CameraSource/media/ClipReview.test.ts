import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClipReview } from './ClipReview';

const clip = { blob: new Blob(['clip']), mimeType: 'video/x-matroska;codecs=avc1' };

beforeEach(() => {
  let next = 0;
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:${++next}`);
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ClipReview', () => {
  it('show revokes the previous URL', () => {
    const review = new ClipReview();
    expect(review.show(clip)).toBe('blob:1');
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();

    expect(review.show(clip)).toBe('blob:2');
    expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:1');
  });

  it('take makes the file at call time', () => {
    const review = new ClipReview();
    const date = vi.spyOn(Date, 'now').mockReturnValue(1000);
    review.show(clip);

    date.mockReturnValue(2000);
    const file = review.take();

    expect([file?.name, file?.type, file?.lastModified]).toEqual(['video-2000.mkv', 'video/x-matroska', 2000]);
    expect(review.take()).toBeNull();
  });

  it('close revokes the URL, forgets the clip and drops the mirroring', () => {
    const review = new ClipReview();
    review.show(clip);
    review.mirrored = true;

    review.close();
    review.close();

    expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:1');
    expect([review.take(), review.mirrored]).toEqual([null, false]);
  });

  it('the icon follows playback', () => {
    const review = new ClipReview();
    review.playing(true);
    expect(review.timelineIcon).toBe('pause');
    review.resetIcon();
    expect(review.timelineIcon).toBe('play');
  });
});
