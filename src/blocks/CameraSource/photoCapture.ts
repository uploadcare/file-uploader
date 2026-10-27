import { centerCrop } from './aspectRatio';

/** The part of `ImageCapture` used here. It only exists in Chromium-based browsers, so TypeScript's DOM types lack it. */
type PhotoCapabilities = {
  imageWidth?: { max?: number; min?: number };
  imageHeight?: { max?: number; min?: number };
};
type PhotoSettings = { imageWidth?: number; imageHeight?: number };
type ImageCaptureLike = {
  getPhotoCapabilities(): Promise<PhotoCapabilities>;
  takePhoto(settings?: PhotoSettings): Promise<Blob>;
};
type ImageCaptureConstructor = new (track: MediaStreamTrack) => ImageCaptureLike;

const imageCaptureConstructor = (): ImageCaptureConstructor | undefined => {
  const ctor = (globalThis as { ImageCapture?: unknown }).ImageCapture;
  return typeof ctor === 'function' ? (ctor as ImageCaptureConstructor) : undefined;
};

/** Whether photos can come from `ImageCapture.takePhoto()` rather than from the preview frame. */
export const canTakePhoto = (): boolean => imageCaptureConstructor() !== undefined;

/**
 * The still size to ask `takePhoto()` for: the size the stream already runs at. Asking for any other size makes some
 * cameras switch into a photo mode, and the preview can stay at that size or framing after the shot. The stream
 * already follows `cameraResolution`, so photos do too. `undefined`, leaving the size to the camera, when it reports
 * no photo limits or the stream size is outside them.
 */
export const photoSettingsFor = ({
  width,
  height,
  capabilities,
}: {
  width: number;
  height: number;
  capabilities: PhotoCapabilities;
}): PhotoSettings | undefined => {
  const { imageWidth, imageHeight } = capabilities;
  const fits = (size: number, range?: { max?: number; min?: number }) =>
    range?.max !== undefined && size <= range.max && size >= (range.min ?? 0);
  if (!width || !height || !fits(width, imageWidth) || !fits(height, imageHeight)) {
    return undefined;
  }
  return { imageWidth: width, imageHeight: height };
};

/**
 * Takes a still with `ImageCapture`, at the stream's own size. Rejects where `ImageCapture` is missing or the camera
 * refuses, so the caller can keep the preview frame instead.
 */
export const takePhoto = async (track: MediaStreamTrack): Promise<ImageBitmap> => {
  const ImageCapture = imageCaptureConstructor();
  if (!ImageCapture) {
    throw new Error('ImageCapture is not supported');
  }
  const capture = new ImageCapture(track);
  const { width = 0, height = 0 } = track.getSettings();
  // Capabilities are optional: some cameras take stills without reporting limits.
  const capabilities = await capture.getPhotoCapabilities().catch(() => ({}));
  const blob = await capture.takePhoto(photoSettingsFor({ width, height, capabilities }));
  return createImageBitmap(blob);
};

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
