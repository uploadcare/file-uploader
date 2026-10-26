import type { ComplexAttributeConverter } from 'lit';
import { parseBooleanAttribute } from '../utils/boolean-attribute';

export { parseBooleanAttribute };

/** Lit converter for a block's boolean property, following {@link parseBooleanAttribute}. */
export const booleanAttribute: ComplexAttributeConverter<boolean> = {
  fromAttribute: (value) => value !== null && parseBooleanAttribute(value),
  toAttribute: (value) => (value ? '' : null),
};
