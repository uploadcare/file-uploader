/**
 * @param {Number} a Start of sample (int)
 * @param {Number} b End of sample (int)
 * @param {Number} n Number of elements (int)
 * @returns {Number[]}
 */
export function linspace(a, b, n) {
  let ret = Array(n);
  n--;
  for (let i = n; i >= 0; i--) {
    ret[i] = Math.ceil((i * b + (n - i) * a) / n);
  }
  return ret;
}
