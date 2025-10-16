type ParseableParams = Record<string, string | number | boolean | null | undefined>;

export const parseObjectToString = (params: ParseableParams): (string | number | boolean | null | undefined)[] =>
  Object.entries(params)
    .filter(([_, value]) => value !== undefined && value !== '')
    .map(([key, value]) => {
      if (key === 'cdn-operations') {
        return value;
      }
      if (key === 'analytics') {
        return value;
      }

      return `${key}/${value}`;
    });
