export function linspace(a: number, b: number, n: number): number[] {
  const length = n;
  const lastIndex = n - 1;
  const ret = new Array<number>(length);
  for (let i = lastIndex; i >= 0; i -= 1) {
    ret[i] = Math.ceil((i * b + (lastIndex - i) * a) / lastIndex);
  }
  return ret;
}
