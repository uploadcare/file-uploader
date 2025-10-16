import type { ThemeDefinition } from './types';

type ThemeCustomProperty = keyof ThemeDefinition;

const ucCustomProperties: ThemeCustomProperty[] = [
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
];

const getCssValue = (element: HTMLElement, propName: ThemeCustomProperty): string => {
  const style = window.getComputedStyle(element);
  return style.getPropertyValue(propName).trim();
};

export const buildThemeDefinition = (element: HTMLElement): Record<ThemeCustomProperty, string> => {
  const theme: Partial<Record<ThemeCustomProperty, string>> = {};

  for (const prop of ucCustomProperties) {
    const value = getCssValue(element, prop);
    if (value) {
      theme[prop] = value;
    }
  }
  return theme as Record<ThemeCustomProperty, string>;
};
