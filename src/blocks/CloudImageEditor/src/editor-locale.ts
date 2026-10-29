import { applyTemplateData } from '../../../utils/template-utils';
import { ALL_FILTERS } from './toolbar-constants';

export type EditorL10nVariables = Record<string, string | number>;
export type EditorL10n = (key: string, variables?: EditorL10nVariables) => string;

export const EDITOR_DEFAULT_LOCALE: Record<string, string> = {
  cancel: 'Cancel',
  apply: 'Apply',
  brightness: 'Brightness',
  exposure: 'Exposure',
  gamma: 'Gamma',
  contrast: 'Contrast',
  saturation: 'Saturation',
  vibrance: 'Vibrance',
  warmth: 'Warmth',
  enhance: 'Enhance',
  original: 'Original',
  crop: 'Crop',
  rotate: 'Rotate',
  mirror: 'Mirror',
  flip: 'Flip',
  'a11y-editor-tab-crop': 'Crop',
  'a11y-editor-tab-tuning': 'Tuning',
  'a11y-editor-tab-filters': 'Filters',
  'a11y-cloud-editor-apply-filter': 'Apply {{name}} filter',
  'a11y-cloud-editor-apply-crop': 'Apply {{name}} operation',
  'a11y-cloud-editor-apply-tuning': 'Apply {{name}} tuning',
  'a11y-cloud-editor-apply-aspect-ratio': 'Apply operation {{name}} {{value}}',
  'crop-to-shape': 'Crop to {{value}}',
  custom: 'Freeform',
  'freeform-crop': 'Freeform crop',
  // Filter labels are the capitalised filter name.
  ...Object.fromEntries(ALL_FILTERS.map((name) => [name, name.charAt(0).toUpperCase() + name.slice(1)])),
};

export function resolveEditorL10n(overrides?: Record<string, string>): EditorL10n {
  return (key, variables = {}) => {
    const template = overrides?.[key] ?? EDITOR_DEFAULT_LOCALE[key] ?? key;
    return applyTemplateData(template, variables);
  };
}
