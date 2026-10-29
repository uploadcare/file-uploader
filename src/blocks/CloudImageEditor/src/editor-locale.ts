import { EDITOR_SHARED_STRINGS } from '../../../abstract/editor-shared-strings';
import { applyTemplateData } from '../../../utils/template-utils';
import { ALL_FILTERS, type FilterId } from './toolbar-constants';

/** Every key the editor's own locale holds: the standalone editor resolves no other. */
export type EditorL10nKey = keyof typeof EDITOR_SHARED_STRINGS | FilterId;

export type EditorL10nVariables = Record<string, string | number>;
export type EditorL10n = (key: string, variables?: EditorL10nVariables) => string;

export const EDITOR_DEFAULT_LOCALE: Record<string, string> = {
  ...EDITOR_SHARED_STRINGS,
  // Filter labels are the capitalised filter name.
  ...Object.fromEntries(ALL_FILTERS.map((name) => [name, name.charAt(0).toUpperCase() + name.slice(1)])),
};

export function resolveEditorL10n(overrides?: Record<string, string>): EditorL10n {
  return (key, variables = {}) => {
    const template = overrides?.[key] ?? EDITOR_DEFAULT_LOCALE[key] ?? key;
    return applyTemplateData(template, variables);
  };
}
