/**
 * @template {void} T
 * @template {unknown} R
 * @returns {{ promise: Promise<T>; resolve: (value?: T | PromiseLike<T>) => void; reject: (reason?: R) => void }}
 */
export const withResolvers = () => {
  /** @type {(value?: any) => void} */
  let resolve;
  /** @type {(reason?: any) => void} */
  let reject;

  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
};
