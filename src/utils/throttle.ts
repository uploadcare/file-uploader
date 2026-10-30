export const throttle = <T extends (...args: any[]) => void>(fn: T, wait: number): T & { cancel: () => void } => {
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
  }) as T & { cancel: () => void };

  throttled.cancel = () => {
    if (lastFn) clearTimeout(lastFn);
  };

  return throttled;
};
