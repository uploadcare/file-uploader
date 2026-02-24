import type { ConfigType, OutputFileEntry } from '../../../types/exported';
import type { CustomConfig, CustomConfigDefinition } from '../../customConfigOptions';
import type { UploaderPublicApi } from '../../UploaderPublicApi';

export type PluginVersion = string;

export type PluginIconRegistration = {
  name: string;
  svg: string;
};

export type PluginI18nRegistration = Record<string, Record<string, string>>;

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

export type PluginFileTransformerContext = {
  /** The file to transform */
  file: File | Blob;
  /** MIME type of the file */
  mimeType: string | null;
};

export type PluginFileTransformerRegistration = {
  /**
   * Transform a file before it is uploaded.
   * Return the modified File or Blob. Return the original file if no transformation is needed.
   */
  transform: (context: PluginFileTransformerContext) => File | Blob | Promise<File | Blob>;
};

export type PluginRegistryApi = {
  registerSource: (source: PluginSourceRegistration) => PluginSourceRegistration;
  registerActivity: (activity: PluginActivityRegistration) => PluginActivityRegistration;
  registerFileAction: (fileAction: PluginFileActionRegistration) => PluginFileActionRegistration;
  registerFileTransformer: (transformer: PluginFileTransformerRegistration) => PluginFileTransformerRegistration;
  registerIcon: (icon: PluginIconRegistration) => PluginIconRegistration;
  registerI18n: (i18n: PluginI18nRegistration) => PluginI18nRegistration;
  registerConfig: <T = unknown>(definition: CustomConfigDefinition<T>) => void;
};

/**
 * API for managing plugin config subscriptions
 */
export type PluginConfigApi = {
  get: <TKey extends keyof (ConfigType & CustomConfig)>(configName: TKey) => (ConfigType & CustomConfig)[TKey];
  subscribe: <TKey extends keyof (ConfigType & CustomConfig)>(
    configName: TKey,
    callback: (value: (ConfigType & CustomConfig)[TKey]) => void,
  ) => () => void;
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
  fileTransformers: Owned<PluginFileTransformerRegistration>[];
  icons: Owned<PluginIconRegistration>[];
  i18n: Owned<PluginI18nRegistration>[];
};
