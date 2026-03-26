import type { ConfigType, OutputFileEntry } from '../../../types/exported';
import type { CustomConfig, CustomConfigDefinition } from '../../customConfigOptions';
import type { UploaderPublicApi } from '../../UploaderPublicApi';

export type PluginIconRegistration = {
  name: string;
  svg: string;
};

export type PluginI18nRegistration = Record<string, Record<string, string>>;

export type PluginSourceRegistration = {
  id: string;
  label: string;
  icon?: string;
  /**
   * @internal
   *
   * Optional expansion function. When present, SourceList calls this to determine
   * which source IDs should actually be rendered in place of this source.
   * Useful for sources that map to multiple device-specific variants (e.g. camera
   * expanding to separate photo/video buttons on mobile).
   * Return `[id]` (the source's own id) to render it as-is.
   */
  expand?: () => string[];
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
  /** Unique action identifier. */
  id: string;
  /** Icon name to display in the action button. */
  icon: string;
  /** Label shown next to the icon in the action button. Accepts a plain string or an i18n key registered via `registerI18n`. */
  label: string;
  /** Return `true` to show the action button for the given file entry. */
  shouldRender: (fileEntry: OutputFileEntry) => boolean;
  onClick: (fileEntry: OutputFileEntry) => void | Promise<void>;
};

export type PluginFileHookResult = {
  /** The (optionally transformed) file */
  file: File | Blob;
};

export type PluginFileHookContext = PluginFileHookResult & {
  /**
   * An AbortSignal that fires when the operation is cancelled (e.g. upload aborted or file removed).
   * Hooks should respect this signal to avoid doing unnecessary work.
   */
  signal: AbortSignal;
};

export type PluginFileHookRegistration = {
  /**
   * When the hook is called:
   * - `'beforeUpload'`: called right before the file is uploaded.
   * - `'onAdd'`: called after the file is added to the upload list.
   *
   * Return the (optionally transformed) file. After the hook runs, `mimeType`,
   * `isImage`, `fileSize`, and `fileName` are all re-derived from the returned file.
   */
  type: 'beforeUpload' | 'onAdd';
  handler: (context: PluginFileHookContext) => PluginFileHookResult | Promise<PluginFileHookResult>;
  /**
   * Maximum time in milliseconds to wait for the hook to complete before skipping it.
   * @default 30000
   */
  timeout?: number;
};

export type PluginRegistryApi = {
  registerSource: (source: PluginSourceRegistration) => void;
  registerActivity: (activity: PluginActivityRegistration) => void;
  registerFileAction: (fileAction: PluginFileActionRegistration) => void;
  registerFileHook: (hook: PluginFileHookRegistration) => void;
  registerIcon: (icon: PluginIconRegistration) => void;
  registerI18n: (i18n: PluginI18nRegistration) => void;
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

export type PluginFileEntryUpdate = {
  file?: File | Blob;
  cdnUrl?: string | null;
  cdnUrlModifiers?: string | null;
  mimeType?: string | null;
};

export type PluginFilesApi = {
  /**
   * Update mutable properties of a file entry by its internalId.
   * `fileSize` is recalculated automatically when `file` is provided.
   */
  update: (internalId: string, changes: PluginFileEntryUpdate) => void;
};

export type PluginApi = {
  registry: PluginRegistryApi;
  config: PluginConfigApi;
  activity: PluginActivityApi;
  files: PluginFilesApi;
};

export type PluginUploaderApi = UploaderPublicApi;

// biome-ignore lint/suspicious/noConfusingVoidType: That's a function return type
export type PluginSetupResult = (() => void) | void | Promise<(() => void) | void>;

export type PluginSetupParams = {
  pluginApi: PluginApi;
  uploaderApi: PluginUploaderApi;
};

export type UploaderPlugin = {
  id: string;
  setup: (params: PluginSetupParams) => PluginSetupResult;
};

export type Owned<T> = T & { pluginId: string };

export type PluginRegistrySnapshot = {
  sources: Owned<PluginSourceRegistration>[];
  activities: Owned<PluginActivityRegistration>[];
  fileActions: Owned<PluginFileActionRegistration>[];
  fileHooks: Owned<PluginFileHookRegistration>[];
  icons: Owned<PluginIconRegistration>[];
  i18n: Owned<PluginI18nRegistration>[];
};
