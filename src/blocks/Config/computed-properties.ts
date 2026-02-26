import { getPrefixedCdnBaseAsync, isPrefixedCdnBase } from '@uploadcare/cname-prefix/async';
import type { UploaderPlugin } from '../../abstract/managers/plugin';
import type { ConfigType } from '../../types/index';
import { deserializeCsv, serializeCsv } from '../../utils/comma-separated';
import { isPromiseLike } from '../../utils/isPromiseLike';
import { ExternalUploadSource } from '../../utils/UploadSource';
import { DEFAULT_CDN_CNAME } from './initialConfig';

type ConfigKey = keyof ConfigType;
type ConfigValue<TKey extends ConfigKey> = ConfigType[TKey];
type DepKeys<TKey extends ConfigKey> = ReadonlyArray<Exclude<ConfigKey, TKey>>;

type ComputedPropertyArgs<TKey extends ConfigKey, TDeps extends DepKeys<TKey>> = {
  [K in TKey]: () => ConfigValue<K>;
} & {
  [K in TDeps[number]]: () => ConfigValue<K>;
};

type ComputedPropertyOptions = {
  signal: AbortSignal;
};

type ComputedPropertyFn<TKey extends ConfigKey, TDeps extends DepKeys<TKey>> = (
  args: ComputedPropertyArgs<TKey, TDeps>,
  options: ComputedPropertyOptions,
) => ConfigValue<TKey> | Promise<ConfigValue<TKey>>;

type ComputedPropertyDeclaration<TKey extends ConfigKey, TDeps extends DepKeys<TKey>> = {
  key: TKey;
  deps: TDeps;
  fn: ComputedPropertyFn<TKey, TDeps>;
};

export type ComputedPropertyControllers = Map<ComputedPropertyFn<any, any>, AbortController>

const defineComputedProperty = <TKey extends ConfigKey, TDeps extends DepKeys<TKey>>(
  declaration: ComputedPropertyDeclaration<TKey, TDeps>,
): ComputedPropertyDeclaration<TKey, TDeps> => declaration;

type LazyPluginEntry = {
  pluginId: string;
  isEnabled: () => boolean;
  load: () => Promise<UploaderPlugin | undefined>;
};

const withLazyPlugins = async ({
  plugins,
  entries,
  signal,
}: {
  plugins: () => UploaderPlugin[];
  entries: LazyPluginEntry[];
  signal: AbortSignal;
}): Promise<UploaderPlugin[]> => {
  const current = plugins();
  const lazyIds = new Set(entries.map((e) => e.pluginId));
  const userPlugins = current.filter((p) => !lazyIds.has(p?.id));

  const loadResults = await Promise.all(
    entries.map(async (entry): Promise<UploaderPlugin | null> => {
      if (!entry.isEnabled()) return null;
      const existing = current.find((p) => p?.id === entry.pluginId);
      if (existing) return existing;
      try {
        const plugin = await entry.load();
        if (signal.aborted || !entry.isEnabled()) return null;
        return plugin ?? null;
      } catch (error) {
        if (!signal.aborted) {
          console.warn(`[${entry.pluginId}] Failed to load plugin`, error);
        }
        return null;
      }
    }),
  );

  if (signal.aborted) return current;

  const lazyPlugins = loadResults.filter((p): p is UploaderPlugin => p !== null);
  const next = [...userPlugins, ...lazyPlugins];

  if (next.length === current.length && next.every((p, i) => p === current[i])) {
    return current;
  }

  return next;
};

const COMPUTED_PROPERTIES = [
  defineComputedProperty({
    key: 'cameraModes',
    deps: ['enableVideoRecording'] as const,
    fn: ({ cameraModes, enableVideoRecording }) => {
      const evr = enableVideoRecording();
      if (evr === null) {
        return cameraModes();
      }
      let cameraModesCsv = deserializeCsv(cameraModes());
      if (evr && !cameraModesCsv.includes('video')) {
        cameraModesCsv = cameraModesCsv.concat('video');
      } else if (!evr) {
        cameraModesCsv = cameraModesCsv.filter((mode) => mode !== 'video');
      }
      return serializeCsv(cameraModesCsv);
    },
  }),
  defineComputedProperty({
    key: 'cameraModes',
    deps: ['defaultCameraMode'] as const,
    fn: ({ cameraModes, defaultCameraMode }) => {
      const dcm = defaultCameraMode();
      if (dcm === null) {
        return cameraModes();
      }
      let cameraModesCsv = deserializeCsv(cameraModes());
      cameraModesCsv = cameraModesCsv.sort((a, b) => {
        if (a === dcm) return -1;
        if (b === dcm) return 1;
        return 0;
      });
      return serializeCsv(cameraModesCsv);
    },
  }),
  defineComputedProperty({
    key: 'cdnCname',
    deps: ['pubkey', 'cdnCnamePrefixed'] as const,
    fn: ({ pubkey, cdnCname, cdnCnamePrefixed }) => {
      const pk = pubkey();
      const cname = cdnCname();
      const prefixed = cdnCnamePrefixed();
      if (pk && (cname === DEFAULT_CDN_CNAME || isPrefixedCdnBase(cname, prefixed))) {
        return getPrefixedCdnBaseAsync(pk, prefixed);
      }

      return cname;
    },
  }),
  defineComputedProperty({
    key: 'plugins',
    deps: ['useCloudImageEditor', 'imageShrink', 'sourceList'] as const,
    fn: ({ plugins, useCloudImageEditor, imageShrink, sourceList }, { signal }) =>
      withLazyPlugins({
        plugins,
        entries: [
          {
            pluginId: 'cloud-image-editor',
            isEnabled: () => !!useCloudImageEditor(),
            load: async () => {
              const { cloudImageEditorPlugin } = await import('../../plugins/cloudImageEditorPlugin');
              return cloudImageEditorPlugin;
            },
          },
          {
            pluginId: 'image-shrink',
            isEnabled: () => !!imageShrink(),
            load: async () => {
              const { imageShrinkPlugin } = await import('../../plugins/imageShrinkPlugin');
              return imageShrinkPlugin;
            },
          },
          {
            pluginId: 'camera',
            isEnabled: () => deserializeCsv(sourceList()).includes('camera'),
            load: async () => {
              const { cameraPlugin } = await import('../../plugins/cameraPlugin');
              return cameraPlugin;
            },
          },
          {
            pluginId: 'instagram',
            isEnabled: () => deserializeCsv(sourceList()).includes('instagram'),
            load: async () => {
              const { instagramPlugin } = await import('../../plugins/instagramPlugin');
              return instagramPlugin;
            },
          },
          {
            pluginId: 'external-sources',
            isEnabled: () =>
              Object.values(ExternalUploadSource).some((src) => deserializeCsv(sourceList()).includes(src)),
            load: async () => {
              const { externalSourcesPlugin } = await import('../../plugins/externalSourcesPlugin');
              return externalSourcesPlugin;
            },
          },
          {
            pluginId: 'url-source',
            isEnabled: () => deserializeCsv(sourceList()).includes('url'),
            load: async () => {
              const { urlSourcePlugin } = await import('../../plugins/urlSourcePlugin');
              return urlSourcePlugin;
            },
          },
        ],
        signal,
      }),
  }),
];

type ConfigSetter = <TSetValue extends ConfigKey>(key: TSetValue, value: ConfigValue<TSetValue>) => void;
type ConfigGetter = <TGetValue extends ConfigKey>(key: TGetValue) => ConfigValue<TGetValue>;

type ComputePropertyOptions<TKey extends ConfigKey> = {
  key: TKey;
  setValue: ConfigSetter;
  getValue: ConfigGetter;
  computationControllers: ComputedPropertyControllers;
};

export const computeProperty = <TKey extends ConfigKey>({
  key,
  setValue,
  getValue,
  computationControllers,
}: ComputePropertyOptions<TKey>) => {
  for (const computed of COMPUTED_PROPERTIES) {
    if (computed.deps.includes(key)) {
      const args: Partial<Record<ConfigKey, () => ConfigType[ConfigKey]>> = {
        [computed.key]: () => getValue(computed.key),
      };

      for (const dep of computed.deps) {
        args[dep] = () => getValue(dep);
      }
      const abortController = new AbortController();

      computationControllers.get(computed.fn)?.abort();
      computationControllers.set(computed.fn, abortController);

      let result: ConfigValue<typeof computed.key> | Promise<ConfigValue<typeof computed.key>>;
      try {
        result = computed.fn(args as ComputedPropertyArgs<typeof computed.key, typeof computed.deps>, {
          signal: abortController.signal,
        });
      } catch (error) {
        if (computationControllers.get(computed.fn) === abortController) {
          computationControllers.delete(computed.fn);
        }
        console.error(`Failed to compute value for "${computed.key}"`, error);
        return;
      }
      if (isPromiseLike(result)) {
        result
          .then((resolvedValue) => {
            if (abortController.signal.aborted) {
              return;
            }
            setValue(computed.key, resolvedValue);
          })
          .catch((error) => {
            if (abortController.signal.aborted) {
              return;
            }
            console.error(`Failed to compute value for "${computed.key}"`, error);
          })
          .finally(() => {
            if (computationControllers.get(computed.fn) === abortController) {
              computationControllers.delete(computed.fn);
            }
          });
      } else {
        setValue(computed.key, result);
      }
    }
  }
};
