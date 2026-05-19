export function pick<T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    const value = obj[key];
    if (Object.hasOwn(obj, key) || value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}
