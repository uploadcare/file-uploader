import type { LitSolutionBlock } from '../lit/LitSolutionBlock';

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
   * Plugin initialization function called when plugin is registered
   * @param solution - The solution block instance (FileUploaderRegular, FileUploaderInline, etc.)
   */
  init(solution: LitSolutionBlock): void;

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

  /**
   * Optional configuration passed to the plugin
   */
  config?: Record<string, unknown>;
}
