import { calculateMaxCenteredCropFrame } from '../blocks/CloudImageEditor/src/crop-utils';
import { parseCropPreset } from '../blocks/CloudImageEditor/src/lib/parseCropPreset';
import type { ConfigType } from '../types';
import { createCdnUrl, createCdnUrlModifiers } from '../utils/cdn-utils';
import type { UploadCollectionController } from './controllers/UploadCollectionController';

/**
 * Apply the configured `cropPreset` as an initial centered crop to every
 * uploaded image entry that doesn't already carry a crop modifier. Pure
 * collection logic — extracted from `LitUploaderBlock._setInitialCrop` so the
 * upload-events wiring (which triggers it on upload success) can live outside
 * the element layer.
 */
export function applyInitialCrop(collection: UploadCollectionController, cropPreset: ConfigType['cropPreset']): void {
  const parsed = parseCropPreset(cropPreset);
  // `parseCropPreset` never returns a falsy value — an empty or fully-invalid
  // preset yields an empty list. Bail out then: a rejected preset must not
  // fall through to the 1:1 default and crop images nobody asked to crop.
  if (parsed.length === 0) return;

  const [aspectRatioPreset] = parsed;
  const entries = collection
    .findItems(
      (entry) =>
        !!entry.getValue('fileInfo') &&
        entry.getValue('isImage') &&
        !entry.getValue('cdnUrlModifiers')?.includes('/crop/'),
    )
    .map((id) => collection.read(id))
    .filter(Boolean);

  for (const entry of entries) {
    const fileInfo = entry.getValue('fileInfo');
    if (!fileInfo || !fileInfo.imageInfo) {
      console.warn('Failed to get image info for entry', entry.uid);
      continue;
    }
    const { width, height } = fileInfo.imageInfo;
    const expectedAspectRatio =
      typeof aspectRatioPreset?.width === 'number' &&
      typeof aspectRatioPreset?.height === 'number' &&
      aspectRatioPreset.width > 0 &&
      aspectRatioPreset.height > 0
        ? aspectRatioPreset.width / aspectRatioPreset.height
        : 1;

    const crop = calculateMaxCenteredCropFrame(width, height, expectedAspectRatio);
    const cdnUrlModifiers = createCdnUrlModifiers(`crop/${crop.width}x${crop.height}/${crop.x},${crop.y}`, 'preview');
    const cdnUrl = entry.getValue('cdnUrl');
    if (!cdnUrl) {
      console.warn('Failed to get cdnUrl for entry', entry.uid);
      continue;
    }
    entry.setMultipleValues({
      cdnUrlModifiers,
      cdnUrl: createCdnUrl(cdnUrl, cdnUrlModifiers),
    });
  }
}
