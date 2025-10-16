import { TRANSPARENT_PIXEL_SRC } from './transparentPixelSrc';

export function preloadImage(src: string): {
  promise: Promise<void>;
  image: HTMLImageElement;
  cancel: () => void;
} {
  const image: HTMLImageElement = new Image();

  const promise: Promise<void> = new Promise<void>((resolve, reject) => {
    image.src = src;
    image.onload = () => resolve();
    image.onerror = (err) => reject(err);
  });

  const cancel = () => {
    if (image.naturalWidth === 0) {
      image.src = TRANSPARENT_PIXEL_SRC;
    }
  };

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
