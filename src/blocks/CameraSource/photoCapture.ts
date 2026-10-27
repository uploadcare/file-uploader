import type { CameraResolution } from '../../types/exported';
import { centerCrop } from './aspectRatio';
import { RESOLUTION_SHORT_SIDE } from './buildConstraints';

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
 * The still size to ask `takePhoto()` for: the camera's own shape, with the short side `cameraResolution` asks for
 * (1080 for `auto`), capped at what the camera reports. `undefined` when it reports no limits, leaving the size to it.
 */
export const photoSettingsFor = ({
  width,
  height,
  resolution,
  capabilities,
}: {
  width: number;
  height: number;
  resolution: CameraResolution;
  capabilities: PhotoCapabilities;
}): PhotoSettings | undefined => {
  const maxWidth = capabilities.imageWidth?.max;
  const maxHeight = capabilities.imageHeight?.max;
  if (!maxWidth || !maxHeight || !width || !height) {
    return undefined;
  }
  const shortSide = RESOLUTION_SHORT_SIDE[resolution === 'auto' ? '1080p' : resolution];
  const scale = Math.min(shortSide / Math.min(width, height), maxWidth / width, maxHeight / height);
  return { imageWidth: Math.round(width * scale), imageHeight: Math.round(height * scale) };
};

/**
 * Takes a still with `ImageCapture`, at the size `photoSettingsFor` picks. Rejects where `ImageCapture` is missing or
 * the camera refuses, so the caller can keep the preview frame instead.
 */
export const takePhoto = async (track: MediaStreamTrack, resolution: CameraResolution): Promise<ImageBitmap> => {
  const ImageCapture = imageCaptureConstructor();
  if (!ImageCapture) {
    throw new Error('ImageCapture is not supported');
  }
  const capture = new ImageCapture(track);
  const { width = 0, height = 0 } = track.getSettings();
  // Capabilities are optional: some cameras take stills without reporting limits.
  const capabilities = await capture.getPhotoCapabilities().catch(() => ({}));
  const blob = await capture.takePhoto(photoSettingsFor({ width, height, resolution, capabilities }));
  return createImageBitmap(blob);
};

/**
 * Draws a photo the way every capture path does: the largest centered rectangle of `aspectRatio`, mirrored when
 * asked. The crop is centered, so mirroring the canvas mirrors the crop too.
 */
export const drawPhoto = ({
  source,
  width,
  height,
  aspectRatio,
  mirror,
}: {
  source: CanvasImageSource;
  width: number;
  height: number;
  aspectRatio: number | null;
  mirror: boolean;
}): HTMLCanvasElement => {
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
