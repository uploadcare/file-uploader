import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateThumb } from './resizeImage';

vi.mock('./preloadImage', () => ({
  preloadImage: () => ({ promise: Promise.resolve(), image: { width: 10, height: 10 }, cancel: () => {} }),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('generateThumb', () => {
  it('rejects with an Error saying the thumbnail could not be encoded when the canvas gives no blob', async () => {
    const createElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName !== 'canvas') return createElement(tagName);
      const canvas = createElement('canvas');
      const context = { fillRect: () => {}, drawImage: () => {}, fillStyle: '' };
      return Object.assign(canvas, {
        getContext: () => context,
        toBlob: (callback: BlobCallback) => callback(null),
      });
    });

    // `toThrow` would let an `undefined` reason through, which is the bug.
    await expect(generateThumb(new File(['x'], 'a.png', { type: 'image/png' }))).rejects.toMatchObject({
      message: 'Failed to encode the thumbnail',
    });
  });
});
