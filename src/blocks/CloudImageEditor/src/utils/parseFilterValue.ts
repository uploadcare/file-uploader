/**
 * Parses a string like "iothari 100" into an object { filter: "iothari", value: 100 }
 */
export function parseFilterValue(str: string): { filter: string; value: number } | null {
  const match = str.match(/^([A-Za-z]+)\s+(\d+)$/);
  if (!match) return null;
  const [, filter, amount] = match;
  if (!filter || typeof amount === 'undefined') {
    return null;
  }
  return { filter, value: Number(amount) };
}
