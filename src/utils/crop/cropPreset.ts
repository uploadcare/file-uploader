import { logger } from '../../abstract/logger';
import type { ConfigType } from '../../types/exported';
import { deserializeCsv } from '../comma-separated';
import { UID } from '../UID';

const log = logger.scope('crop-preset');

export interface CropAspectRatio {
  type: 'aspect-ratio';
  width: number;
  height: number;
  id: string;
  hasFreeform?: boolean;
}

export type CropPresetList = CropAspectRatio[];

export const parseCropPreset = (cropPreset: ConfigType['cropPreset']): CropAspectRatio[] => {
  const result: CropAspectRatio[] = [];
  for (const raw of deserializeCsv(cropPreset)) {
    const hasFreeform = raw === 'free';
    const [w = NaN, h = NaN] = hasFreeform ? [0, 0] : raw.split(':').map(Number);
    if (!hasFreeform && !(w > 0 && h > 0 && Number.isFinite(w) && Number.isFinite(h))) {
      log.warn(`Invalid crop preset: ${raw}`);
      continue;
    }
    result.push({ id: UID.generateFastUid(), type: 'aspect-ratio', width: w, height: h, hasFreeform });
  }
  return result;
};

export const getClosestAspectRatio = (
  width: number,
  height: number,
  ratios: CropPresetList,
  tolerance = 0.1,
): CropAspectRatio | null => {
  const inputRatio = width / height;

  let closest = null;
  let minDiff = Infinity;

  for (const r of ratios) {
    const ratio = r.width / r.height;

    const diff = Math.abs(inputRatio - ratio);

    if (diff < minDiff) {
      minDiff = diff;
      closest = r;
    }
  }

  if (closest) {
    const closestRatio = closest.width / closest.height;

    const relDiff = Math.abs(inputRatio - closestRatio) / closestRatio;
    if (relDiff > tolerance) {
      return null;
    }
  }

  return closest;
};
