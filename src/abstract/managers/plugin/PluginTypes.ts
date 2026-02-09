import type { LocaleDefinition } from '../../localeRegistry';
import type { UploaderPublicApi } from '../../UploaderPublicApi';

export type PluginVersion = string;

export type PluginIconRegistration = {
  name: string;
  svg: string;
};

export type PluginI18nRegistration = Record<string, Partial<LocaleDefinition>>;

export type PluginSourceHelpers = {
  navigate: (activityId: string | null, params?: Record<string, unknown>) => void;
  startUpload: (input: unknown) => Promise<void> | void;
};

export type PluginSourceRegistration = {
  id: string;
  label: string;
  icon?: string;
  onSelect: (helpers: PluginSourceHelpers) => Promise<void> | void;
};

export type PluginActivityDispose = () => void;

export type PluginActivityRender = (el: HTMLElement) => void | PluginActivityDispose;

export type PluginActivityRegistration = {
  id: string;
  icon?: string;
  render: PluginActivityRender;
};

export type PluginSlotRegistration = {
  slot: string;
  id: string;
  icon?: string;
  render: PluginActivityRender;
};

export type PluginRegistryApi = {
  registerSource: (source: PluginSourceRegistration) => PluginSourceRegistration;
  registerActivity: (activity: PluginActivityRegistration) => PluginActivityRegistration;
  registerSlot: (slot: PluginSlotRegistration) => PluginSlotRegistration;
  registerIcon: (icon: PluginIconRegistration) => PluginIconRegistration;
  registerI18n: (i18n: PluginI18nRegistration) => PluginI18nRegistration;
};

export type PluginApi = {
  registry: PluginRegistryApi;
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
  slots: Owned<PluginSlotRegistration>[];
  icons: Owned<PluginIconRegistration>[];
  i18n: Owned<PluginI18nRegistration>[];
};
