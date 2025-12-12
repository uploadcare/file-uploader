import type { ConfigType } from '../../../../types/exported';
import { stringToArray } from '../../../../utils/stringToArray';
import { UID } from '../../../../utils/UID';
import type { CropAspectRatio, CropPresetList } from '../types';

const EXCLUDED_TYPES = ['free'];

export const parseCropPreset = (cropPreset: ConfigType['cropPreset']): CropAspectRatio[] => {
  const items = stringToArray(cropPreset);
  if (!items || items.length === 0) return [];

  const result: CropAspectRatio[] = [];
  for (const item of items) {
    const raw = item.trim();
    if (!raw) continue;

    const sep = raw.indexOf(':');
    if (sep === -1 && !EXCLUDED_TYPES.includes(raw)) {
      console.warn(`Invalid crop preset: ${raw}`);
      continue;
    }

    const w = Number(raw.slice(0, sep));
    const h = Number(raw.slice(sep + 1));

    if ((!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) && !EXCLUDED_TYPES.includes(raw)) {
      console.warn(`Invalid crop preset: ${raw}`);
      continue;
    }

    result.push({
      id: UID.generateFastUid(),
      type: 'aspect-ratio',
      width: EXCLUDED_TYPES.includes(raw) ? 0 : w,
      height: EXCLUDED_TYPES.includes(raw) ? 0 : h,
      hasFreeform: EXCLUDED_TYPES.includes(raw),
    });
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
    const [w, h] = [r.width, r.height];
    const ratio = w / h;

    const diff = Math.abs(inputRatio - ratio);

    if (diff < minDiff) {
      minDiff = diff;
      closest = r;
    }
  }

  if (closest) {
    const [cw, ch] = [closest.width, closest.height];
    const closestRatio = cw / ch;

    const relDiff = Math.abs(inputRatio - closestRatio) / closestRatio;
    if (relDiff > tolerance) {
      return null;
    }
  }

  return closest;
};
