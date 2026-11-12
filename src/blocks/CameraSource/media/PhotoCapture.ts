import { centerCrop } from '../../../abstract/camera/aspectRatio';
import { createCameraFile } from './cameraFile';

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

/** The photo as a file to upload, named and dated now. */
export const photoFile = (blob: Blob): File => createCameraFile('camera', 'jpeg', 'image/jpeg', blob);

/** The photo under review, as the JPEG it will be sent as. */
export class PhotoCapture {
  private _shot: Promise<Blob> | null = null;

  /** Draws the frame `video` shows and starts encoding it, synchronously; the caller pauses the preview after. */
  public take(video: HTMLVideoElement, options: Pick<PhotoOptions, 'aspectRatio' | 'mirror' | 'quality'>): void {
    this._shot = renderPhoto(video, { ...options, width: video.videoWidth, height: video.videoHeight });
    // Accept awaits and reports a failure; until then (or after a retake) the rejection would go unhandled.
    this._shot.catch(() => {});
  }

  /** Hands the shot over and forgets it. */
  public claim(): Promise<Blob> | null {
    const shot = this._shot;
    this._shot = null;
    return shot;
  }

  public discard(): void {
    this._shot = null;
  }
}
