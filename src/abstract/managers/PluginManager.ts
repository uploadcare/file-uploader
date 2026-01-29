import type { LitSolutionBlock } from '../../lit/LitSolutionBlock';
import type { Plugin, PluginConfig } from '../Plugin';
import { PluginStateAPIImpl } from '../PluginStateAPI';

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

    // Register plugin config options if any
    if (plugin.config) {
      this._registerPluginConfig(plugin);
    }

    this._plugins.set(plugin.pluginId, plugin);

    // If manager is already initialized, initialize the plugin immediately
    if (this._initialized) {
      this._initializePlugin(plugin);
    }
  }

  /**
   * Register config options defined by a plugin
   */
  private _registerPluginConfig(plugin: Plugin): void {
    if (!plugin.config) {
      return;
    }

    // Add plugin config defaults to the solution's config
    for (const [key, option] of Object.entries(plugin.config)) {
      // Check if config key is already defined
      const existingValue = this._solution.cfg[key as keyof typeof this._solution.cfg];
      
      // If not defined or is default, set the plugin's default value
      if (existingValue === undefined || existingValue === null) {
        this._solution.cfg[key as keyof typeof this._solution.cfg] = option.defaultValue as any;
      }
    }
  }

  /**
   * Initialize a single plugin
   */
  private _initializePlugin(plugin: Plugin): void {
    try {
      // Create state API wrapper for the plugin
      const stateAPI = new PluginStateAPIImpl(this._solution);
      plugin.init(stateAPI);
    } catch (error) {
      console.error(`Failed to initialize plugin "${plugin.pluginId}":`, error);
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
      this._initializePlugin(plugin);
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
