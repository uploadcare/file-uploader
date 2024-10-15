// @ts-check

/**
 * @param {HTMLElement} element
 * @param {string} propName
 */
function getCssValue(element, propName) {
  let style = window.getComputedStyle(element);
  return style.getPropertyValue(propName).trim();
}

const ucCustomProperties = /** @type {(keyof import('./types.js').ThemeDefinition)[]} */ ([
  '--uc-font-family',
  '--uc-font-size',
  '--uc-line-height',
  '--uc-button-size',
  '--uc-preview-size',
  '--uc-input-size',
  '--uc-padding',
  '--uc-radius',
  '--uc-transition',
  '--uc-background',
  '--uc-foreground',
  '--uc-primary',
  '--uc-primary-hover',
  '--uc-primary-transparent',
  '--uc-primary-foreground',
  '--uc-secondary',
  '--uc-secondary-hover',
  '--uc-secondary-foreground',
  '--uc-muted',
  '--uc-muted-foreground',
  '--uc-destructive',
  '--uc-destructive-foreground',
  '--uc-border',
]);

/** @param {HTMLElement} element */
export function buildThemeDefinition(element) {
  return ucCustomProperties.reduce((acc, prop) => {
    const value = getCssValue(element, prop);
    if (value) {
      acc[prop] = value;
    }
    return acc;
  }, /** @type {Record<keyof import('./types.js').ThemeDefinition, string>} */ ({}));
}
