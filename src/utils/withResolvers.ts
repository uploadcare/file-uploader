export const withResolvers = <T = void, R = unknown>(): {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: R) => void;
} => {
  let resolveFn: (value: T | PromiseLike<T>) => void = () => {};
  let rejectFn: (reason?: R) => void = () => {};

  const promise = new Promise<T>((res, rej) => {
    resolveFn = res;
    rejectFn = rej as unknown as (reason?: R) => void;
  });

  return { promise, resolve: resolveFn, reject: rejectFn };
};
