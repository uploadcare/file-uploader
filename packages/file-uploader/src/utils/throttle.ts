type Throttled<T extends (...args: any[]) => void> = ((...args: Parameters<T>) => void) & {
  readonly cancel: () => void;
};

export const throttle = <T extends (...args: any[]) => void>(
  fn: T,
  wait: number,
): T & { readonly cancel: () => void } => {
  let inThrottle = false;
  let lastFn: ReturnType<typeof setTimeout> | undefined;
  let lastTime = 0;

  const throttled = ((...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      lastTime = Date.now();
      inThrottle = true;
    } else {
      if (lastFn) clearTimeout(lastFn);
      lastFn = setTimeout(
        () => {
          if (Date.now() - lastTime >= wait) {
            fn(...args);
            lastTime = Date.now();
          }
        },
        Math.max(wait - (Date.now() - lastTime), 0),
      );
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
