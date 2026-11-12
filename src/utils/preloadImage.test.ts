import { afterEach, describe, expect, it, vi } from 'vitest';
import { preloadImage } from './preloadImage';

afterEach(() => {
  vi.unstubAllGlobals();
});

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

describe('preloadImage cancel()', () => {
  it('rejects with an AbortError, even though the placeholder it swaps in loads', async () => {
    // Loads whatever it is pointed at, a while later: the cancelled url never, the placeholder pixel right away.
    class LoadingImage {
      public onerror: ((event: Event) => void) | null = null;
      public onload: (() => void) | null = null;
      public naturalWidth = 0;
      public set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal('Image', LoadingImage);
    const { promise, cancel } = preloadImage('https://ucarecdn.com/slow/');

    cancel();

    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('preloadImage with a signal', () => {
  class PendingImage {
    public onerror: ((event: Event) => void) | null = null;
    public onload: (() => void) | null = null;
    public naturalWidth = 0;
    public src = '';
  }

  it('rejects with the abort reason and cancels the load when the signal aborts', async () => {
    vi.stubGlobal('Image', PendingImage);
    const controller = new AbortController();
    const { promise, image } = preloadImage('https://ucarecdn.com/slow/', { signal: controller.signal });

    controller.abort();

    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
    expect(image.src).not.toBe('https://ucarecdn.com/slow/');
  });

  it("rejects with the signal's own reason, not cancel()'s", async () => {
    vi.stubGlobal('Image', PendingImage);
    const controller = new AbortController();
    const reason = new Error('the thumb was replaced');
    const { promise } = preloadImage('https://ucarecdn.com/slow/', { signal: controller.signal });

    controller.abort(reason);

    await expect(promise).rejects.toBe(reason);
  });

  it('rejects without loading when the signal has already aborted', async () => {
    vi.stubGlobal('Image', PendingImage);
    const { promise, image } = preloadImage('https://ucarecdn.com/slow/', { signal: AbortSignal.abort() });

    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
    expect(image.src).toBe('');
  });
});

describe('preloadImage with decode', () => {
  const decodingImage = (result: 'decodes' | 'fails') =>
    class {
      public onerror: ((event: Event) => void) | null = null;
      public onload: (() => void) | null = null;
      public naturalWidth = 0;
      public decoding = 'auto';
      public src = '';
      public decode = vi.fn(() =>
        result === 'decodes' ? Promise.resolve() : Promise.reject(new Error('EncodingError')),
      );
    };

  it('resolves once the image is decoded, asking for async decoding', async () => {
    vi.stubGlobal('Image', decodingImage('decodes'));
    const { promise, image } = preloadImage('https://ucarecdn.com/ok/', { decode: true });

    await expect(promise).resolves.toBeUndefined();
    expect(image.decode).toHaveBeenCalledOnce();
    expect(image.decoding).toBe('async');
    expect(image.src).toBe('https://ucarecdn.com/ok/');
  });

  it('rejects with an Error that names the url when decoding fails', async () => {
    vi.stubGlobal('Image', decodingImage('fails'));

    await expect(preloadImage('https://ucarecdn.com/broken/', { decode: true }).promise).rejects.toThrow(
      'Failed to load image https://ucarecdn.com/broken/',
    );
  });
});
