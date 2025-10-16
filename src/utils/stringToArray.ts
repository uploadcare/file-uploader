export const stringToArray = (str: string, delimiter = ','): string[] => {
  return str
    .trim()
    .split(delimiter)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
};
