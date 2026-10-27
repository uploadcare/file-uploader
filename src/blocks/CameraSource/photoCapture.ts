import { centerCrop } from './aspectRatio';

export type PhotoOptions = {
  /** The source's pixel size: a `<video>` reports it as `videoWidth` / `videoHeight`, not `width` / `height`. */
  width: number;
  height: number;
  aspectRatio: number | null;
  mirror: boolean;
  /** JPEG quality, 0..1. */
  quality: number;
};

/**
 * The largest centered rectangle of `aspectRatio`, mirrored when asked. The crop is centered, so mirroring the canvas
 * mirrors the crop too. Drawing is synchronous, so a `<video>` source is captured at the moment of the call.
 */
const drawPhoto = (
  source: CanvasImageSource,
  { width, height, aspectRatio, mirror }: Omit<PhotoOptions, 'quality'>,
): HTMLCanvasElement => {
  const crop = aspectRatio ? centerCrop(width, height, aspectRatio) : { x: 0, y: 0, width, height };
  const canvas = document.createElement('canvas');
  canvas.width = crop.width;
  canvas.height = crop.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }
  if (mirror) {
    ctx.translate(crop.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
  return canvas;
};

/**
 * A photo as every capture path makes it: cropped, mirrored and encoded as JPEG. The canvas is only how browsers encode
 * images; nothing outside needs it.
 */
export const renderPhoto = (source: CanvasImageSource, options: PhotoOptions): Promise<Blob> => {
  const canvas = drawPhoto(source, options);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Failed to encode the photo'))),
      'image/jpeg',
      options.quality,
    );
  });
};
