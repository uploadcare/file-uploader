// @ts-check

/** @param {string} value */
export const deserealizeCsv = (value) => {
  if (!value) {
    return [];
  }

  return value.split(',').map((item) => item.trim());
};

/** @param {unknown[]} value */
export const serializeCsv = (value) => {
  if (!value) {
    return '';
  }

  return value.join(',');
};
