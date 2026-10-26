import { TRANSPARENT_PIXEL_SRC } from './transparentPixelSrc';

/**
 * `signal` aborts the load: the promise rejects with its reason and the image stops loading. `decode` waits for the
 * image to be decoded too, so showing it afterwards doesn't stall a frame.
 */
export function preloadImage(
  src: string,
  { signal, decode = false }: { signal?: AbortSignal; decode?: boolean } = {},
): {
  promise: Promise<void>;
  image: HTMLImageElement;
  cancel: () => void;
} {
  const image: HTMLImageElement = new Image();
  let rejectLoad: (reason: unknown) => void = () => {};

  // Stops the load and rejects with an AbortError. Rejected first, so the placeholder's own load can't resolve it.
  const cancel = () => {
    rejectLoad(new DOMException('The image preload was cancelled', 'AbortError'));
    if (image.naturalWidth === 0) {
      image.src = TRANSPARENT_PIXEL_SRC;
    }
  };

  const promise: Promise<void> = new Promise<void>((resolve, reject) => {
    rejectLoad = reject;
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const onAbort = () => {
      // The signal's reason first: `cancel` rejects too, with its own.
      reject(signal?.reason);
      cancel();
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    const onLoad = () => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    };
    const onError = () => {
      signal?.removeEventListener('abort', onAbort);
      reject(new Error(`Failed to load image ${src}`));
    };
    if (decode) {
      image.decoding = 'async';
      image.src = src;
      image.decode().then(onLoad, onError);
      return;
    }
    image.onload = onLoad;
    image.onerror = onError;
    image.src = src;
  });

  return { promise, image, cancel };
}

export function batchPreloadImages(list: string[]): {
  promise: Promise<PromiseSettledResult<void>[]>;
  images: HTMLImageElement[];
  cancel: () => void;
} {
  const preloaders: ReturnType<typeof preloadImage>[] = [];

  for (const src of list) {
    const preload = preloadImage(src);
    preloaders.push(preload);
  }

  const images = preloaders.map((preload) => preload.image);
  const promise = Promise.allSettled(preloaders.map((preload) => preload.promise));
  const cancel = () => {
    preloaders.forEach((preload) => {
      preload.cancel();
    });
  };

  return { promise, images, cancel };
}
