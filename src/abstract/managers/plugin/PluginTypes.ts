import type { ConfigType, OutputFileEntry } from '../../../types/exported';
import type { ActivityParamsMap } from '../../activity-constants';
import type { NavigationEdge } from '../../controllers/RouterController';
import type { CustomConfig, CustomConfigDefinition } from '../../customConfigOptions';
import type { L10nKey, PlainText } from '../../l10n';
import type { Logger } from '../../logger';
import type { UploaderPublicApi } from '../../UploaderPublicApi';

export type PluginIconRegistration = {
  name: string;
  svg: string;
};

/**
 * Translations by locale name. Declared keys — built in, or added to `CustomLocaleDefinition` with
 * `declare module '@uploadcare/file-uploader' { interface CustomLocaleDefinition { 'my-plugin.title': string } }` —
 * autocomplete; any other key is accepted too, as in v1.
 */
// NEXT-MAJOR(plugins): declared keys only (`Partial<Record<L10nKey, string>>`). Kept for 1.x compat.
export type PluginL10nRegistration = Record<string, Partial<Record<L10nKey | (string & {}), string>>>;

/**
 * A plugin's label: an l10n key, built in or declared in `CustomLocaleDefinition` and registered via `registerL10n`,
 * or text meant to be shown as written, asserted `'My source' as PlainText`.
 *
 * Any other string still compiles and is shown as written, as in v1, but is deprecated.
 */
// NEXT-MAJOR(plugins): `L10nKey | PlainText` only, then drop `pluginLabelKey`. Kept for 1.x compat.
export type PluginLabel = L10nKey | PlainText | (string & {});

/**
 * A plugin label as the blocks' checked `l10n()` takes it. The lookup handles any string — an unknown one is shown as
 * written — so this only narrows the type.
 */
export const pluginLabelKey = (label: PluginLabel): L10nKey | PlainText => label as L10nKey | PlainText;

export type PluginSourceRegistration = {
  id: string;
  label: PluginLabel;
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

/**
 * The params an activity's label sees: its declared params (built-in, or from `CustomActivities`) with each one
 * optional, since a closed activity gets `{}`. An activity without declared params gets any record.
 */
export type PluginActivityLabelParams<TId extends string> = TId extends keyof ActivityParamsMap
  ? [ActivityParamsMap[TId]] extends [never]
    ? Record<string, never>
    : Partial<ActivityParamsMap[TId]>
  : Record<string, unknown>;

export type PluginActivityRegistration<TId extends string = string> = {
  id: TId;
  render: PluginRender;
  /**
   * Names the activity's dialog when it opens in a modal. A function gets the params the activity was opened with
   * (`{}` while it is closed). Without a label the dialog stays unnamed.
   */
  label?: PluginLabel | ((activityParams: PluginActivityLabelParams<TId>) => PluginLabel | undefined);
};

export type PluginFileActionRegistration = {
  /** Unique action identifier. */
  id: string;
  /** Icon name to display in the action button. */
  icon: string;
  /** Label shown next to the icon in the action button. */
  label: PluginLabel;
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
  registerActivity: <TId extends string>(activity: PluginActivityRegistration<TId>) => void;
  registerFileAction: (fileAction: PluginFileActionRegistration) => void;
  registerFileHook: (hook: PluginFileHookRegistration) => void;
  registerIcon: (icon: PluginIconRegistration) => void;
  registerL10n: (l10n: PluginL10nRegistration) => void;
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
   *
   * Other file operations (add / remove / `replaceFile`) live on the public
   * uploader API, which plugins receive as `uploaderApi` in `setup`.
   */
  update: (internalId: string, changes: PluginFileEntryUpdate) => void;
};

/**
 * Deliberately minimal router surface for plugins — navigation *intents* only,
 * not the full router. Plugins that need a hard navigation to a concrete
 * target already have `uploaderApi.navigate()`; this exists for the flows
 * where the host's hooks must stay in charge.
 */
export type PluginRouterApi = {
  /**
   * Express a navigation intent and let the router resolve it, exactly like
   * the built-in sources: registered hooks may intercept, otherwise the
   * edge's default applies — `onBack`/`onCancel` go back, `onClose` closes
   * everything, `onDone` lands on the preset's done activity, and
   * `onFileAdd` opens `upload-list` (unless e.g. the minimal preset keeps
   * its modal closed and shows status inline). Call `traverse('onFileAdd')`
   * after adding files instead of navigating to `upload-list` directly.
   */
  traverse: (edge: NavigationEdge) => void;
};

export type PluginApi = {
  registry: PluginRegistryApi;
  config: PluginConfigApi;
  activity: PluginActivityApi;
  files: PluginFilesApi;
  router: PluginRouterApi;
  /**
   * Logger pre-scoped to this plugin (`[uc][<ctx-name>][plugin:<plugin-id>]`).
   * `error`/`warn`/`warnOnce` always print; the verbose tier (`log`/`debug`)
   * prints only when the uploader's `debug` config is on. Prefer this over
   * `console.*` so plugin output is attributable and gated.
   */
  logger: Logger;
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
  l10n: Owned<PluginL10nRegistration>[];
};
