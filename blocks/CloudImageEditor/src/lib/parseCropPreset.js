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

    if (EXCLUDED_TYPES.includes(raw)) {
      result.push({
        id: UID.generate(),
        type: 'aspect-ratio',
        hasFreeform: true,
        _active: i === 0,

        //@ts-ignore
        width: null,
        //@ts-ignore
        height: null,
      });
      continue;
    }

    const sep = raw.indexOf(':');
    if (sep === -1) {
      console.error(`Invalid crop preset: ${raw}`);
      continue;
    }

    const w = Number(raw.slice(0, sep));
    const h = Number(raw.slice(sep + 1));

    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
      console.error(`Invalid crop preset: ${raw}`);
      continue;
    }

    result.push({
      id: UID.generate(),
      type: 'aspect-ratio',
      width: w,
      height: h,
      _active: i === 0,
    });
  }
  return result;
};
