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
   * Whether to create a property accessor (getter/setter) on the Config element
   * @default true
   */
  accessor?: boolean;
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
 * Custom config definition with plugin ownership tracking
 */
export type OwnedCustomConfigDefinition<T = unknown> = CustomConfigDefinition<T> & {
  pluginId: string;
};

/**
 * Registry for custom config options defined by plugins
 * This is managed by the PluginManager as a shared instance property
 */
export class CustomConfigRegistry {
  // biome-ignore lint/suspicious/noExplicitAny: Custom config values can be of any type
  private _definitions = new Map<string, OwnedCustomConfigDefinition<any>>();

  public register<T = unknown>(pluginId: string, definition: CustomConfigDefinition<T>): void {
    if (this._definitions.has(definition.name)) {
      console.warn(`[CustomConfig] Config option "${definition.name}" is already registered`);
      return;
    }

    const ownedDefinition: OwnedCustomConfigDefinition<T> = {
      ...definition,
      pluginId,
    };

    // biome-ignore lint/suspicious/noExplicitAny: Custom config values can be of any type
    this._definitions.set(definition.name, ownedDefinition as OwnedCustomConfigDefinition<any>);
  }

  public unregister(name: string): void {
    this._definitions.delete(name);
  }

  public unregisterByPlugin(pluginId: string): void {
    for (const [name, definition] of this._definitions) {
      if (definition.pluginId === pluginId) {
        this._definitions.delete(name);
      }
    }
  }

  // biome-ignore lint/suspicious/noExplicitAny: Custom config values can be of any type
  public get(name: string): CustomConfigDefinition<any> | undefined {
    return this._definitions.get(name);
  }

  // biome-ignore lint/suspicious/noExplicitAny: Custom config values can be of any type
  public getAll(): Map<string, CustomConfigDefinition<any>> {
    return new Map(this._definitions);
  }
}

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
