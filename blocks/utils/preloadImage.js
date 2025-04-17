import { TRANSPARENT_PIXEL_SRC } from '../../utils/transparentPixelSrc.js';

export function preloadImage(src) {
  let image = new Image();

  let promise = new Promise((resolve, reject) => {
    image.src = src;
    image.onload = resolve;
    image.onerror = reject;
  });

  let cancel = () => {
    if (image.naturalWidth === 0) {
      image.src = TRANSPARENT_PIXEL_SRC;
    }
  };

  return { promise, image, cancel };
}

export function batchPreloadImages(list) {
  let preloaders = [];

  for (let src of list) {
    let preload = preloadImage(src);
    preloaders.push(preload);
  }

  let images = preloaders.map((preload) => preload.image);
  let promise = Promise.allSettled(preloaders.map((preload) => preload.promise));
  let cancel = () => {
    preloaders.forEach((preload) => {
      preload.cancel();
    });
  };

  return { promise, images, cancel };
}
