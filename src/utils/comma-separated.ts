export const deserializeCsv = (value: string): string[] => {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

export const serializeCsv = (value: readonly string[] | string[]): string => {
  return value.join(',');
};
