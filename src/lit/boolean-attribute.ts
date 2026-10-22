import type { ComplexAttributeConverter } from 'lit';

/**
 * The one boolean-attribute rule, shared by `<uc-config>` and the blocks. Like an HTML boolean attribute, any value
 * means true (`headless`, `headless=""`, `headless="value"`) except `"false"`, which frameworks such as React, Angular
 * and Vue 2 write for a false binding.
 */
export const parseBooleanAttribute = (value: string): boolean => value !== 'false';

/** Lit converter for a block's boolean property, following {@link parseBooleanAttribute}. */
export const booleanAttribute: ComplexAttributeConverter<boolean> = {
  fromAttribute: (value) => value !== null && parseBooleanAttribute(value),
  toAttribute: (value) => (value ? '' : null),
};
