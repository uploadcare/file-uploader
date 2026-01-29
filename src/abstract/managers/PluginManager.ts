import type { LitSolutionBlock } from '../../lit/LitSolutionBlock';
import type { Plugin, PluginConfig } from '../Plugin';

/**
 * Manages plugin registration and lifecycle for file uploader solutions
 */
export class PluginManager {
  private _plugins: Map<string, Plugin> = new Map();
  private _solution: LitSolutionBlock;
  private _initialized = false;

  public constructor(solution: LitSolutionBlock) {
    this._solution = solution;
  }

  /**
   * Register a plugin with the uploader
   * @param pluginConfig - Plugin configuration
   */
  public register(pluginConfig: PluginConfig): void {
    const { plugin } = pluginConfig;

    if (this._plugins.has(plugin.pluginId)) {
      console.warn(`Plugin "${plugin.pluginId}" is already registered`);
      return;
    }

    this._plugins.set(plugin.pluginId, plugin);

    // If manager is already initialized, initialize the plugin immediately
    if (this._initialized) {
      plugin.init(this._solution);
    }
  }

  /**
   * Initialize all registered plugins
   * Called by the solution during its initialization
   */
  public initPlugins(): void {
    if (this._initialized) {
      return;
    }

    for (const plugin of this._plugins.values()) {
      try {
        plugin.init(this._solution);
      } catch (error) {
        console.error(`Failed to initialize plugin "${plugin.pluginId}":`, error);
      }
    }

    this._initialized = true;
  }

  /**
   * Destroy all plugins
   * Called when solution is destroyed
   */
  public destroyPlugins(): void {
    for (const plugin of this._plugins.values()) {
      try {
        plugin.destroy?.();
      } catch (error) {
        console.error(`Failed to destroy plugin "${plugin.pluginId}":`, error);
      }
    }

    this._plugins.clear();
    this._initialized = false;
  }

  /**
   * Check if a plugin is registered
   */
  public hasPlugin(pluginId: string): boolean {
    return this._plugins.has(pluginId);
  }

  /**
   * Get a registered plugin by ID
   */
  public getPlugin(pluginId: string): Plugin | undefined {
    return this._plugins.get(pluginId);
  }
}
