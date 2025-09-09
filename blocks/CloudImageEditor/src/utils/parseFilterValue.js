/**
 * Parses a string like "iothari 100" into an object { filter: "iothari", value: 100 }
 *
 * @param {string} str
 * @returns {{ filter: string; value: number } | null}
 */
export function parseFilterValue(str) {
  const match = str.match(/^(\w+)\s+(\d+)$/);
  if (!match) return null;
  return { filter: match[1], value: Number(match[2]) };
}
