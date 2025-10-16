export function debounce<T extends (...args: any[]) => any>(callback: T, wait: number): T & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const debounced = ((...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => callback(...args), wait);
  }) as T & { cancel: () => void };

  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
  };

  return debounced;
}
