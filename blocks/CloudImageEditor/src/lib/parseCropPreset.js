// @ts-check

import { UID } from '@symbiotejs/symbiote';
import { stringToArray } from '../../../../utils/stringToArray.js';

/** @param {import('../../../../types/exported.d.ts').ConfigType['cropPreset']} cropPreset */
export const parseCropPreset = (cropPreset) => {
  const list = stringToArray(cropPreset);

  if (!list) return [];

  return list.map((it, index) => {
    const [w, h] = it.split(':').map(Number);
    if (!Number.isFinite(w) || !Number.isFinite(h)) {
      console.error(`Invalid crop preset: ${it}`);
      return;
    }
    /** @type {import('../types.js').CropAspectRatio} */
    return { id: UID.generate(), _active: index === 0, type: 'aspect-ratio', width: w, height: h };
  });
};
