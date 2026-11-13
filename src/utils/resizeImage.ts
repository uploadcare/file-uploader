import { preloadImage } from './preloadImage';

const MAX_BITMAP_SIDE = 4096;

export async function generateThumb(imgFile: Blob, size = 40): Promise<string> {
  if (imgFile.type === 'image/svg+xml') {
    // TODO: Return destuctor here
    return URL.createObjectURL(imgFile);
  }
  const canvas: HTMLCanvasElement = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas context not supported');
  }
  const srcUrl = URL.createObjectURL(imgFile);
  // Loaded for its size only, which costs no decode: an `<img>` is decoded when it is first drawn.
  const { promise, image: img } = preloadImage(srcUrl);
  await promise.finally(() => URL.revokeObjectURL(srcUrl));
  const ratio = img.height / img.width;
  const isPortrait = ratio > 1;
  canvas.width = isPortrait ? size : size / ratio;
  canvas.height = isPortrait ? size * ratio : size;
  ctx.fillStyle = 'rgb(240, 240, 240)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Decodes and downscales off the main thread. Only the shorter side is asked for, so the longer one tells whether
  // the browser did as asked: one that drops the resize options answers full size, one that drops the orientation
  // answers with a picture lying on its side.
  // Not for a thumbnail far longer than any picture shown in a list: a file of a few bytes, one pixel wide, would be
  // scaled up to a bitmap of hundreds of megabytes. Drawn from the `<img>` it is never upscaled.
  const bitmap =
    Math.max(canvas.width, canvas.height) > MAX_BITMAP_SIDE
      ? undefined
      : await globalThis
          .createImageBitmap?.(imgFile, {
            [isPortrait ? 'resizeWidth' : 'resizeHeight']: size,
            resizeQuality: 'medium',
            imageOrientation: 'from-image',
          })
          .catch(() => undefined);
  // The bitmap's longer side is rounded where the canvas truncates.
  if (bitmap && Math.abs(bitmap.width - canvas.width) < 2 && Math.abs(bitmap.height - canvas.height) < 2) {
    ctx.drawImage(bitmap, 0, 0);
  } else {
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  }
  bitmap?.close();

  return new Promise<string>((resolve, reject) => {
    canvas.toBlob((blob: Blob | null) => {
      if (!blob) {
        reject(new Error('Failed to encode the thumbnail'));
        return;
      }
      resolve(URL.createObjectURL(blob));
    });
  });
}
