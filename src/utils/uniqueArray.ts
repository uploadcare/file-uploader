export const uniqueArray = <T>(arr: T[]): T[] => {
  return [...new Set(arr)];
};
