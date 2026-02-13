import type { ConfigType, OutputFileEntry } from '../../../types/exported';
import type { CustomConfig, CustomConfigDefinition } from '../../customConfigOptions';
import type { LocaleDefinition } from '../../localeRegistry';
import type { UploaderPublicApi } from '../../UploaderPublicApi';

export type PluginVersion = string;

export type PluginIconRegistration = {
  name: string;
  svg: string;
};

export type PluginI18nRegistration = Record<string, Partial<LocaleDefinition>>;

export type PluginSourceRegistration = {
  id: string;
  label: string;
  icon?: string;
  onSelect: () => Promise<void> | void;
};

export type PluginRenderDispose = () => void;

export type PluginRender = (
  el: HTMLElement,
  activityParams: Record<string, unknown>,
) => PluginRenderDispose | undefined;

export type PluginActivityRegistration = {
  id: string;
  render: PluginRender;
};

export type PluginFileActionRegistration = {
  id: string;
  icon: string;
  shouldRender: (fileEntry: OutputFileEntry) => boolean;
  onClick: (fileEntry: OutputFileEntry) => void | Promise<void>;
};

export type PluginRegistryApi = {
  registerSource: (source: PluginSourceRegistration) => PluginSourceRegistration;
  registerActivity: (activity: PluginActivityRegistration) => PluginActivityRegistration;
  registerFileAction: (fileAction: PluginFileActionRegistration) => PluginFileActionRegistration;
  registerIcon: (icon: PluginIconRegistration) => PluginIconRegistration;
  registerI18n: (i18n: PluginI18nRegistration) => PluginI18nRegistration;
  registerConfig: <T = unknown>(definition: CustomConfigDefinition<T>) => void;
};

/**
 * API for managing plugin config subscriptions
 */
export type PluginConfigApi = {
  /**
   * Get the current value of a config option.
   *
   * @param configName - The name of the config to get
   * @returns The current config value
   *
   * @example
   * ```typescript
   * const theme = pluginApi.config.get('my-theme');
   * console.log('Current theme:', theme);
   * ```
   */
  get: <T = unknown>(configName: keyof (ConfigType & CustomConfig)) => T;

  /**
   * Subscribe to changes in a custom config value.
   * The callback will be called immediately with the current value,
   * and then whenever the value changes.
   *
   * Subscriptions are automatically cleaned up when the plugin is disposed.
   *
   * @param configName - The name of the custom config to subscribe to
   * @param callback - Function to call with the new value
   * @returns Unsubscribe function
   *
   * @example
   * ```typescript
   * pluginApi.config.subscribe('my-option', (value) => {
   *   console.log('Config changed:', value);
   * });
   * // Cleanup happens automatically on plugin disposal
   * ```
   */
  subscribe: <T = unknown>(configName: keyof (ConfigType & CustomConfig), callback: (value: T) => void) => () => void;
};

/**
 * API for managing plugin activity interactions
 */
export type PluginActivityApi = {
  /**
   * Get the current activity parameters.
   *
   * @returns The current activity parameters object
   *
   * @example
   * ```typescript
   * const params = pluginApi.activity.getParams();
   * console.log('Current params:', params);
   * ```
   */
  getParams: () => Record<string, unknown>;

  /**
   * Subscribe to changes in activity parameters.
   * The callback will be called immediately with the current params,
   * and then whenever the params change.
   *
   * Subscriptions are automatically cleaned up when the plugin is disposed.
   *
   * @param callback - Function to call with the new params
   * @returns Unsubscribe function
   *
   * @example
   * ```typescript
   * pluginApi.activity.subscribeToParams((params) => {
   *   console.log('Activity params changed:', params);
   * });
   * // Cleanup happens automatically on plugin disposal
   * ```
   */
  subscribeToParams: (callback: (params: Record<string, unknown>) => void) => () => void;
};

export type PluginApi = {
  registry: PluginRegistryApi;
  config: PluginConfigApi;
  activity: PluginActivityApi;
};

export type PluginUploaderApi = UploaderPublicApi;

export type PluginExports = {
  dispose?: () => void;
};

export type PluginSetupResult = PluginExports | void | Promise<PluginExports | void>;

export type PluginSetupParams = {
  pluginApi: PluginApi;
  uploaderApi: PluginUploaderApi;
};

export type UploaderPlugin = {
  id: string;
  version: PluginVersion;
  setup: (params: PluginSetupParams) => PluginSetupResult;
};

export type Owned<T> = T & { pluginId: string };

export type PluginRegistrySnapshot = {
  sources: Owned<PluginSourceRegistration>[];
  activities: Owned<PluginActivityRegistration>[];
  fileActions: Owned<PluginFileActionRegistration>[];
  icons: Owned<PluginIconRegistration>[];
  i18n: Owned<PluginI18nRegistration>[];
};
