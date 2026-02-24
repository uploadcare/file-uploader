import { getPrefixedCdnBaseAsync, isPrefixedCdnBase } from '@uploadcare/cname-prefix/async';
import type { UploaderPlugin } from '../../abstract/managers/plugin';
import type { ConfigType } from '../../types/index';
import { deserializeCsv, serializeCsv } from '../../utils/comma-separated';
import { isPromiseLike } from '../../utils/isPromiseLike';
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

type ComputedPropertyDeclaration<TKey extends ConfigKey, TDeps extends DepKeys<TKey>> = {
  key: TKey;
  deps: TDeps;
  fn: (
    args: ComputedPropertyArgs<TKey, TDeps>,
    options: ComputedPropertyOptions,
  ) => ConfigValue<TKey> | Promise<ConfigValue<TKey>>;
};

const defineComputedProperty = <TKey extends ConfigKey, TDeps extends DepKeys<TKey>>(
  declaration: ComputedPropertyDeclaration<TKey, TDeps>,
): ComputedPropertyDeclaration<TKey, TDeps> => declaration;

const withLazyPlugin = async ({
  plugins,
  pluginId,
  isEnabled,
  load,
  signal,
}: {
  plugins: () => UploaderPlugin[];
  pluginId: string;
  isEnabled: () => boolean;
  load: () => Promise<UploaderPlugin | undefined>;
  signal: AbortSignal;
}): Promise<UploaderPlugin[]> => {
  const pluginsWithout = () => plugins().filter((p) => p?.id !== pluginId);

  if (!isEnabled()) {
    return pluginsWithout();
  }

  if (plugins().some((p) => p?.id === pluginId)) {
    return plugins();
  }

  try {
    const plugin = await load();
    if (signal.aborted) return plugins();
    if (!isEnabled()) return pluginsWithout();
    if (!plugin) return plugins();
    return [...pluginsWithout(), plugin];
  } catch (error) {
    if (!signal.aborted) {
      console.warn(`[${pluginId}] Failed to load plugin`, error);
    }
    return plugins();
  }
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
    deps: ['useCloudImageEditor'] as const,
    fn: ({ plugins, useCloudImageEditor }, { signal }) =>
      withLazyPlugin({
        plugins,
        pluginId: 'cloud-image-editor',
        isEnabled: () => !!useCloudImageEditor(),
        load: async () => {
          const { cloudImageEditorPlugin } = await import('../../plugins/cloudImageEditorPlugin');
          return cloudImageEditorPlugin;
        },
        signal,
      }),
  }),
  defineComputedProperty({
    key: 'plugins',
    deps: ['imageShrink'] as const,
    fn: ({ plugins, imageShrink }, { signal }) =>
      withLazyPlugin({
        plugins,
        pluginId: 'image-shrink',
        isEnabled: () => !!imageShrink(),
        load: async () => {
          const { imageShrinkPlugin } = await import('../../plugins/imageShrinkPlugin');
          return imageShrinkPlugin;
        },
        signal,
      }),
  }),
];

const computedPropertyKey = (computed: { key: string; deps: ReadonlyArray<string> }): string =>
  `${computed.key}:${computed.deps.join(',')}`;

type ConfigSetter = <TSetValue extends ConfigKey>(key: TSetValue, value: ConfigValue<TSetValue>) => void;
type ConfigGetter = <TGetValue extends ConfigKey>(key: TGetValue) => ConfigValue<TGetValue>;

type ComputePropertyOptions<TKey extends ConfigKey> = {
  key: TKey;
  setValue: ConfigSetter;
  getValue: ConfigGetter;
  computationControllers: Map<string, AbortController>;
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

      computationControllers.get(computedPropertyKey(computed))?.abort();
      computationControllers.set(computedPropertyKey(computed), abortController);

      let result: ConfigValue<typeof computed.key> | Promise<ConfigValue<typeof computed.key>>;
      try {
        result = computed.fn(args as ComputedPropertyArgs<typeof computed.key, typeof computed.deps>, {
          signal: abortController.signal,
        });
      } catch (error) {
        if (computationControllers.get(computedPropertyKey(computed)) === abortController) {
          computationControllers.delete(computedPropertyKey(computed));
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
            if (computationControllers.get(computedPropertyKey(computed)) === abortController) {
              computationControllers.delete(computedPropertyKey(computed));
            }
          });
      } else {
        setValue(computed.key, result);
      }
    }
  }
};
