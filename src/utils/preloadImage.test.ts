import { describe, expect, it, vi } from 'vitest';
import { preloadImage } from './preloadImage';

describe('preloadImage', () => {
  it('rejects with an Error that names the url when the image fails to load', async () => {
    class FailingImage {
      public onerror: ((event: Event) => void) | null = null;
      public onload: (() => void) | null = null;
      public naturalWidth = 0;
      public set src(_value: string) {
        queueMicrotask(() => this.onerror?.(new Event('error')));
      }
    }
    vi.stubGlobal('Image', FailingImage);

    await expect(preloadImage('https://ucarecdn.com/broken/').promise).rejects.toThrow(
      'Failed to load image https://ucarecdn.com/broken/',
    );
  });
});
