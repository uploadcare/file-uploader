export const isPromiseLike = (value: unknown): value is Promise<unknown> => {
  return (
    value instanceof Promise ||
    Boolean(
      value && typeof value === 'object' && 'then' in value && typeof (value as Promise<unknown>).then === 'function',
    )
  );
};
