const warnings = new Set<string>();

export function warnOnce(message: string): void {
  if (warnings.has(message)) {
    return;
  }

  warnings.add(message);
  console.warn(message);
}
