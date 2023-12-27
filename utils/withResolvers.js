// @ts-check

/** @template [T=void] Default is `void` . Default is `void` . Default is `void` . Default is `void` */
export function withResolvers() {
  /** @type {(value: T | PromiseLike<T>) => void} */
  let resolve;
  /** @type {(reason: unknown) => void} */
  let reject;
  /** @type {Promise<T>} */
  const promise = new Promise((_resolve, _reject) => {
    resolve = _resolve;
    reject = _reject;
  });
  return {
    // @ts-expect-error TODO: fix used before assigned
    resolve,
    // @ts-expect-error TODO: fix used before assigned
    reject,
    promise,
  };
}
