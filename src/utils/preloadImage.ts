import { TRANSPARENT_PIXEL_SRC } from './transparentPixelSrc';

/** `signal` aborts the load: the promise rejects with its reason and the image stops loading. */
export function preloadImage(
  src: string,
  { signal }: { signal?: AbortSignal } = {},
): {
  promise: Promise<void>;
  image: HTMLImageElement;
  cancel: () => void;
} {
  const image: HTMLImageElement = new Image();

  const cancel = () => {
    if (image.naturalWidth === 0) {
      image.src = TRANSPARENT_PIXEL_SRC;
    }
  };

  const promise: Promise<void> = new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const onAbort = () => {
      cancel();
      reject(signal?.reason);
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    image.onload = () => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    };
    image.onerror = () => {
      signal?.removeEventListener('abort', onAbort);
      reject(new Error(`Failed to load image ${src}`));
    };
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
