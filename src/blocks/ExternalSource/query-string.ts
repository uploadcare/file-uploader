export function queryString(params: Record<string, string | number | boolean | null | undefined>): string {
  const list: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || (typeof value === 'string' && value.length === 0)) {
      continue;
    }
    list.push(`${key}=${encodeURIComponent(value)}`);
  }
  return list.join('&');
}
