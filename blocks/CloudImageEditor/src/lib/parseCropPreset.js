// @ts-check

/** @param {import('../../../../types/exported.d.ts').ConfigType['cropPreset']} cropPreset */
export const parseCropPreset = (cropPreset) => {
  if (!cropPreset) return [];
  const [w, h] = cropPreset.split(':').map(Number);
  if (!Number.isFinite(w) || !Number.isFinite(h)) {
    console.error(`Invalid crop preset: ${cropPreset}`);
    return;
  }
  /** @type {import('../types.js').CropAspectRatio} */
  const aspectRatio = { type: 'aspect-ratio', width: w, height: h };
  return [aspectRatio];
};
