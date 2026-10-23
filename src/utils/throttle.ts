type Throttled<T extends (...args: any[]) => void> = ((...args: Parameters<T>) => void) & {
  readonly cancel: () => void;
};

export const throttle = <T extends (...args: any[]) => void>(
  fn: T,
  wait: number,
): T & { readonly cancel: () => void } => {
  let lastFn: ReturnType<typeof setTimeout> | undefined;
  let lastTime = 0;

  const run = (args: Parameters<T>) => {
    lastFn = undefined;
    lastTime = Date.now();
    fn(...args);
  };

  const throttled = ((...args: Parameters<T>) => {
    if (lastFn) clearTimeout(lastFn);
    const remaining = wait - (Date.now() - lastTime);
    if (remaining < 0) {
      run(args);
    } else {
      lastFn = setTimeout(() => run(args), remaining);
    }
  }) as Throttled<T>;

  Object.defineProperty(throttled, 'cancel', {
    configurable: false,
    writable: false,
    enumerable: false,
    value: () => {
      if (lastFn) clearTimeout(lastFn);
    },
  });

  return throttled as T & { readonly cancel: () => void };
};
