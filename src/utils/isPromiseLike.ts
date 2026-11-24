export const isPromiseLike = (value: unknown): value is Promise<unknown> =>
  typeof value === 'object' && value !== null && typeof (value as Promise<unknown>).then === 'function';
