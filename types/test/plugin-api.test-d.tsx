import { expectAssignable, expectType } from 'tsd';
import type {
  OutputFileEntry,
  PluginActivityApi,
  PluginApi,
  PluginConfigApi,
  PluginFilesApi,
  PluginRegistryApi,
  PluginRegistrySnapshot,
  PluginUploaderApi,
  UploadCtxProvider,
  UploaderPlugin,
} from '../../dist/index';

// A plugin is an id plus a setup that may dispose, may be async, or may return nothing.
const plugin: UploaderPlugin = {
  id: 'typed',
  setup: ({ pluginApi, uploaderApi }) => {
    expectType<PluginApi>(pluginApi);
    expectType<PluginUploaderApi>(uploaderApi);
    return () => {};
  },
};
expectAssignable<UploaderPlugin>({ id: 'async', setup: async () => {} });
expectAssignable<UploaderPlugin>({ id: 'bare', setup: () => {} });
// @ts-expect-error id is required
expectAssignable<UploaderPlugin>({ setup: () => {} });

// The api handed to a plugin is the same one the provider exposes.
declare const uploaderApi: PluginUploaderApi;
expectType<ReturnType<UploadCtxProvider['getAPI']>>(uploaderApi);

declare const registry: PluginRegistryApi;

registry.registerSource({ id: 'src', label: 'Source', onSelect: () => {} });
registry.registerSource({ id: 'src', label: 'Source', icon: 'icon', onSelect: async () => {} });
// @ts-expect-error onSelect is required
registry.registerSource({ id: 'src', label: 'Source' });

registry.registerActivity({
  id: 'act',
  render: (el, params) => {
    expectType<HTMLElement>(el);
    expectType<Record<string, unknown>>(params);
    return () => {};
  },
});
registry.registerActivity({ id: 'act', render: () => undefined });

registry.registerFileAction({
  id: 'action',
  icon: 'icon',
  label: 'Label',
  shouldRender: (entry) => {
    expectType<OutputFileEntry>(entry);
    return entry.isSuccess;
  },
  onClick: async (entry) => {
    expectType<OutputFileEntry>(entry);
  },
});

registry.registerFileHook({
  type: 'onAdd',
  handler: ({ file, signal }) => {
    expectType<File | Blob>(file);
    expectType<AbortSignal>(signal);
    return { file };
  },
});
registry.registerFileHook({ type: 'beforeUpload', timeout: 1000, handler: async ({ file }) => ({ file }) });
// @ts-expect-error only onAdd and beforeUpload exist
registry.registerFileHook({ type: 'afterUpload', handler: ({ file }) => ({ file }) });

registry.registerIcon({ name: 'icon', svg: '<svg></svg>' });
registry.registerL10n({ en: { key: 'value' } });

// registerConfig infers the option type from defaultValue and holds the converters to it.
registry.registerConfig({ name: 'limit', defaultValue: 10, normalize: (value) => Number(value) });
registry.registerConfig({
  name: 'flag',
  defaultValue: false,
  attribute: true,
  fromAttribute: (value) => value === 'true',
  toAttribute: (value) => {
    expectType<boolean>(value);
    return String(value);
  },
});
// @ts-expect-error normalize must return the option type
registry.registerConfig({ name: 'limit', defaultValue: 10, normalize: (value) => String(value) });

// config.get / subscribe are keyed by the built-in options and typed by them.
declare const config: PluginConfigApi;
expectType<boolean>(config.get('multiple'));
expectType<string>(config.get('pubkey'));
config.subscribe('maxLocalFileSizeBytes', (value) => {
  expectType<number>(value);
});
// @ts-expect-error unknown option
config.get('notAnOption');

declare const activity: PluginActivityApi;
expectType<Record<string, unknown>>(activity.getParams());
expectType<() => void>(activity.subscribeToParams(() => {}));

declare const files: PluginFilesApi;
files.update('id', { mimeType: 'image/png', cdnUrl: null });
// @ts-expect-error only the mutable entry fields can be updated
files.update('id', { name: 'renamed' });

// Every snapshot entry knows which plugin owns it.
declare const snapshot: PluginRegistrySnapshot;
expectType<string>(snapshot.sources[0].pluginId);
expectType<string>(snapshot.fileHooks[0].pluginId);

export { plugin };
