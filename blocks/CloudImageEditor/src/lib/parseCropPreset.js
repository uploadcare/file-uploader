// @ts-check
import { UID } from '@symbiotejs/symbiote';
import { stringToArray } from '../../../../utils/stringToArray.js';

const EXCLUDED_TYPES = ['free'];

/** @param {import('../../../../types/exported.d.ts').ConfigType['cropPreset']} cropPreset */
export const parseCropPreset = (cropPreset) => {
  const items = stringToArray(cropPreset);
  if (!items?.length) return [];

  /** @type {import('../types.js').CropAspectRatio[]} */
  const result = [];
  for (let i = 0; i < items.length; i++) {
    const raw = items[i].trim();
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
      id: UID.generate(),
      type: 'aspect-ratio',
      width: EXCLUDED_TYPES.includes(raw) ? 0 : w,
      height: EXCLUDED_TYPES.includes(raw) ? 0 : h,
      hasFreeform: EXCLUDED_TYPES.includes(raw),
    });
  }

  return result;
};

/**
 * @param {number} width
 * @param {number} height
 * @param {import('../types.js').CropPresetList} ratios
 * @param {number} tolerance
 * @returns {import('../types.js').CropAspectRatio | null}
 */
export const getClosestAspectRatio = (width, height, ratios, tolerance = 0.1) => {
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
