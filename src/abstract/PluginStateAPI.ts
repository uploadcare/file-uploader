import type { LitSolutionBlock } from '../lit/LitSolutionBlock';
import type { LitActivityBlock } from '../lit/LitActivityBlock';
import type { ConfigType } from '../types/exported';

/**
 * Configuration option definition for plugins
 */
export interface PluginConfigOption<T = unknown> {
  /**
   * Default value for the config option
   */
  defaultValue: T;

  /**
   * Validator/normalizer function for the config value
   */
  validator: (value: unknown) => T;
}

/**
 * Source type configuration for plugin-defined sources
 */
export interface PluginSourceConfig {
  /**
   * Unique identifier for this source type
   */
  type: string;

  /**
   * Activity to open when source is activated
   */
  activity: string;

  /**
   * Icon name for the source button
   */
  icon?: string;

  /**
   * Localization key for the button text
   */
  textKey?: string;

  /**
   * Custom activation handler (optional)
   * If provided, overrides default modal opening behavior
   */
  activate?: () => void;
}

/**
 * Activity registration configuration
 */
export interface PluginActivityConfig {
  /**
   * Unique identifier for this activity
   */
  activityType: string;

  /**
   * Callback when activity is activated
   */
  onActivate?: () => void;

  /**
   * Callback when activity is deactivated
   */
  onDeactivate?: () => void;
}

/**
 * State wrapper API for plugins
 * Provides controlled access to solution state without exposing internal methods
 */
export interface PluginStateAPI {
  /**
   * Subscribe to config value changes
   * @param key - Config key to subscribe to
   * @param callback - Callback function called when config value changes
   * @returns Unsubscribe function
   */
  subConfigValue<T extends keyof ConfigType>(
    key: T,
    callback: (value: ConfigType[T]) => void,
  ): () => void;

  /**
   * Get current config value
   * @param key - Config key
   * @returns Current config value
   */
  getConfigValue<T extends keyof ConfigType>(key: T): ConfigType[T];

  /**
   * Set config value
   * @param key - Config key
   * @param value - New value
   */
  setConfigValue<T extends keyof ConfigType>(key: T, value: ConfigType[T]): void;

  /**
   * Subscribe to state changes
   * @param key - State key to subscribe to
   * @param callback - Callback function called when state changes
   * @returns Unsubscribe function
   */
  subscribe<T = unknown>(key: string, callback: (value: T) => void): () => void;

  /**
   * Get current state value
   * @param key - State key
   * @returns Current state value
   */
  getState<T = unknown>(key: string): T;

  /**
   * Set state value
   * @param key - State key
   * @param value - New value
   */
  setState<T = unknown>(key: string, value: T): void;

  /**
   * Navigate to an activity
   * @param activityType - Activity identifier from LitActivityBlock.activities
   * @param params - Optional activity parameters
   */
  setActivity(activityType: string, params?: Record<string, unknown>): void;

  /**
   * Navigate back in activity history
   */
  historyBack(): void;

  /**
   * Register a custom source type
   * @param config - Source configuration
   */
  registerSource(config: PluginSourceConfig): void;

  /**
   * Register a custom activity
   * @param config - Activity configuration
   */
  registerActivity(config: PluginActivityConfig): void;

  /**
   * Get localized string
   * @param key - Localization key
   * @returns Localized string
   */
  l10n(key: string): string;
}

/**
 * Implementation of PluginStateAPI that wraps a LitSolutionBlock
 */
export class PluginStateAPIImpl implements PluginStateAPI {
  private _solution: LitSolutionBlock;

  constructor(solution: LitSolutionBlock) {
    this._solution = solution;
  }

  public subConfigValue<T extends keyof ConfigType>(
    key: T,
    callback: (value: ConfigType[T]) => void,
  ): () => void {
    return this._solution.subConfigValue(key, callback);
  }

  public getConfigValue<T extends keyof ConfigType>(key: T): ConfigType[T] {
    return this._solution.cfg[key];
  }

  public setConfigValue<T extends keyof ConfigType>(key: T, value: ConfigType[T]): void {
    this._solution.cfg[key] = value;
  }

  public subscribe<T = unknown>(key: string, callback: (value: T) => void): () => void {
    return this._solution.sub(key, callback as (value: unknown) => void);
  }

  public getState<T = unknown>(key: string): T {
    return this._solution.$[key] as T;
  }

  public setState<T = unknown>(key: string, value: T): void {
    this._solution.$[key] = value;
  }

  public setActivity(activityType: string, params?: Record<string, unknown>): void {
    if (params) {
      this._solution.$['*currentActivityParams'] = params;
    }
    this._solution.$['*currentActivity'] = activityType;
  }

  public historyBack(): void {
    const historyBack = this._solution.$['*historyBack'] as (() => void) | undefined;
    if (historyBack) {
      historyBack();
    }
  }

  public registerSource(config: PluginSourceConfig): void {
    // This will be implemented by accessing the SourceBtn component
    // For now, we'll store it in a way that SourceBtn can pick it up
    const customSources = this._solution.$['*customSources'] as PluginSourceConfig[] | undefined;
    if (!customSources) {
      this._solution.$['*customSources'] = [config];
    } else {
      customSources.push(config);
    }
  }

  public registerActivity(config: PluginActivityConfig): void {
    // Access the LitActivityBlock to register the activity
    if (this._solution instanceof LitActivityBlock || 
        '_registerActivityFromPlugin' in this._solution) {
      // We'll add a helper method to LitSolutionBlock for this
      (this._solution as any)._registerActivityFromPlugin?.(
        config.activityType,
        {
          onActivate: config.onActivate,
          onDeactivate: config.onDeactivate,
        },
      );
    }
  }

  public l10n(key: string): string {
    return this._solution.l10n(key);
  }
}
