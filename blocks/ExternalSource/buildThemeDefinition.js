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
  '--uc-primary-rgb-light',
  '--uc-primary-light',
  '--uc-primary-hover-light',
  '--uc-primary-transparent-light',
  '--uc-background-light',
  '--uc-foreground-light',
  '--uc-primary-foreground-light',
  '--uc-secondary-light',
  '--uc-secondary-hover-light',
  '--uc-secondary-foreground-light',
  '--uc-muted-light',
  '--uc-muted-foreground-light',
  '--uc-destructive-light',
  '--uc-destructive-foreground-light',
  '--uc-border-light',
  '--uc-primary-rgb-dark',
  '--uc-primary-dark',
  '--uc-primary-hover-dark',
  '--uc-primary-transparent-dark',
  '--uc-background-dark',
  '--uc-foreground-dark',
  '--uc-primary-foreground-dark',
  '--uc-secondary-dark',
  '--uc-secondary-hover-dark',
  '--uc-secondary-foreground-dark',
  '--uc-muted-dark',
  '--uc-muted-foreground-dark',
  '--uc-destructive-dark',
  '--uc-destructive-foreground-dark',
  '--uc-border-dark',
  '--uc-primary-oklch-light',
  '--uc-primary-oklch-dark',
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
