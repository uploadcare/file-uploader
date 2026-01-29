import type { PluginStateAPI, PluginConfigOption } from './PluginStateAPI';

/**
 * Plugin interface for extending file uploader functionality.
 * Plugins can add activities, modals, and custom behaviors to the uploader.
 */
export interface Plugin {
  /**
   * Unique identifier for the plugin
   */
  pluginId: string;

  /**
   * Optional configuration options defined by the plugin
   * Key is the config option name, value is the config option definition
   */
  config?: Record<string, PluginConfigOption>;

  /**
   * Plugin initialization function called when plugin is registered
   * @param api - Plugin state API for controlled access to solution state
   */
  init(api: PluginStateAPI): void;

  /**
   * Optional cleanup function called when solution is destroyed
   */
  destroy?(): void;
}

/**
 * Plugin configuration options
 */
export interface PluginConfig {
  /**
   * Plugin instance
   */
  plugin: Plugin;
}
