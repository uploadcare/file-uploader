// @ts-check

/** @param {string | null} [value] */
export const deserealizeCsv = (value) => {
  return value?.split(',').map((item) => item.trim()) ?? [];
};

/** @param {unknown[]?} [value] */
export const serializeCsv = (value) => {
  return value?.join(',') ?? '';
};
