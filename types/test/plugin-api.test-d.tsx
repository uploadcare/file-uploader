import { expectTypeOf, test } from 'vitest';
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

declare const registry: PluginRegistryApi;
declare const config: PluginConfigApi;
declare const activity: PluginActivityApi;
declare const files: PluginFilesApi;
declare const snapshot: PluginRegistrySnapshot;

test('a plugin is an id plus a setup that may dispose, may be async, or may return nothing', () => {
  const plugin: UploaderPlugin = {
    id: 'typed',
    setup: ({ pluginApi, uploaderApi }) => {
      expectTypeOf(pluginApi).toEqualTypeOf<PluginApi>();
      expectTypeOf(uploaderApi).toEqualTypeOf<PluginUploaderApi>();
      return () => {};
    },
  };
  expectTypeOf(plugin).toEqualTypeOf<UploaderPlugin>();
  expectTypeOf({ id: 'async', setup: async () => {} }).toExtend<UploaderPlugin>();
  expectTypeOf({ id: 'bare', setup: () => {} }).toExtend<UploaderPlugin>();
  // @ts-expect-error id is required
  expectTypeOf({ setup: () => {} }).toExtend<UploaderPlugin>();
});

test('the api handed to a plugin is the one the provider exposes', () => {
  expectTypeOf<PluginUploaderApi>().toEqualTypeOf<ReturnType<UploadCtxProvider['getAPI']>>();
});

test('registerSource takes id, label, optional icon and an onSelect that may be async', () => {
  registry.registerSource({ id: 'src', label: 'Source', onSelect: () => {} });
  registry.registerSource({ id: 'src', label: 'Source', icon: 'icon', onSelect: async () => {} });
  // @ts-expect-error onSelect is required
  registry.registerSource({ id: 'src', label: 'Source' });
});

test('registerActivity hands render the host element and the params, and takes an optional disposer back', () => {
  registry.registerActivity({
    id: 'act',
    render: (el, params) => {
      expectTypeOf(el).toEqualTypeOf<HTMLElement>();
      expectTypeOf(params).toEqualTypeOf<Record<string, unknown>>();
      return () => {};
    },
  });
  registry.registerActivity({ id: 'act', render: () => undefined });
});

test('registerFileAction gets the output entry in shouldRender and onClick', () => {
  registry.registerFileAction({
    id: 'action',
    icon: 'icon',
    label: 'Label',
    shouldRender: (entry) => {
      expectTypeOf(entry).toEqualTypeOf<OutputFileEntry>();
      return entry.isSuccess;
    },
    onClick: async (entry) => {
      expectTypeOf(entry).toEqualTypeOf<OutputFileEntry>();
    },
  });
});

test('registerFileHook runs onAdd or beforeUpload with the file and an abort signal', () => {
  registry.registerFileHook({
    type: 'onAdd',
    handler: ({ file, signal }) => {
      expectTypeOf(file).toEqualTypeOf<File | Blob>();
      expectTypeOf(signal).toEqualTypeOf<AbortSignal>();
      return { file };
    },
  });
  registry.registerFileHook({ type: 'beforeUpload', timeout: 1000, handler: async ({ file }) => ({ file }) });
  // @ts-expect-error only onAdd and beforeUpload exist
  registry.registerFileHook({ type: 'afterUpload', handler: ({ file }) => ({ file }) });
});

test('registerIcon and registerL10n take their documented shapes', () => {
  registry.registerIcon({ name: 'icon', svg: '<svg></svg>' });
  registry.registerL10n({ en: { key: 'value' } });
});

test('registerConfig infers the option type from defaultValue and holds the converters to it', () => {
  registry.registerConfig({ name: 'limit', defaultValue: 10, normalize: (value) => Number(value) });
  registry.registerConfig({
    name: 'flag',
    defaultValue: false,
    attribute: true,
    fromAttribute: (value) => value === 'true',
    toAttribute: (value) => {
      expectTypeOf(value).toEqualTypeOf<boolean>();
      return String(value);
    },
  });
  // @ts-expect-error normalize must return the option type
  registry.registerConfig({ name: 'limit', defaultValue: 10, normalize: (value) => String(value) });
});

test('config.get and config.subscribe are keyed and typed by the built-in options', () => {
  expectTypeOf(config.get('multiple')).toEqualTypeOf<boolean>();
  expectTypeOf(config.get('pubkey')).toEqualTypeOf<string>();
  config.subscribe('maxLocalFileSizeBytes', (value) => {
    expectTypeOf(value).toEqualTypeOf<number>();
  });
  // @ts-expect-error unknown option
  config.get('notAnOption');
});

test('the activity api reads and subscribes to untyped params', () => {
  expectTypeOf(activity.getParams()).toEqualTypeOf<Record<string, unknown>>();
  expectTypeOf(activity.subscribeToParams(() => {})).toEqualTypeOf<() => void>();
});

test('files.update accepts only the mutable entry fields', () => {
  files.update('id', { mimeType: 'image/png', cdnUrl: null });
  // @ts-expect-error name is not updatable
  files.update('id', { name: 'renamed' });
});

test('every registry snapshot entry knows which plugin owns it', () => {
  expectTypeOf(snapshot.sources[0].pluginId).toEqualTypeOf<string>();
  expectTypeOf(snapshot.fileHooks[0].pluginId).toEqualTypeOf<string>();
});
