/**
 * Custom configuration options registration system for plugins
 */

export type CustomConfigDefinition<T = unknown> = {
  /**
   * Config option name (will be used as property and optionally as attribute)
   */
  name: string;
  /**
   * Default value for the config option
   */
  defaultValue: T;
  /**
   * Whether this config can be set via HTML attribute
   * @default true
   */
  attribute?: boolean;
  /**
   * Convert attribute string to config value
   * Only used if attribute is true
   */
  fromAttribute?: (value: string | null) => T;
  /**
   * Convert config value to attribute string
   * Only used if attribute is true
   */
  toAttribute?: (value: T) => string | null;
  /**
   * Normalize/validate the config value
   */
  normalize?: (value: unknown) => T;
};

/**
 * Interface for TypeScript module augmentation
 * Plugins should extend this interface to add their custom config types
 *
 * @example
 * ```typescript
 * declare module '@uploadcare/file-uploader' {
 *   interface CustomConfig {
 *     'my-custom-option': string;
 *   }
 * }
 * ```
 */
// biome-ignore lint/suspicious/noEmptyInterface: This interface is meant to be augmented by plugins
export interface CustomConfig {}
