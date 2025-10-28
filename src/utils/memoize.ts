export function memoize<F extends (...args: any[]) => any>(fn: F): F {
  const cache = new Map<string, ReturnType<F>>();
  const memoized = (...args: Parameters<F>): ReturnType<F> => {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key) as ReturnType<F>;
    }
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
  return memoized as F;
}
