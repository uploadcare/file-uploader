const warnings = new Set();

/** @param {string} message */
export function warnOnce(message) {
  if (warnings.has(message)) {
    return;
  }

  warnings.add(message);
  console.warn(message);
}
