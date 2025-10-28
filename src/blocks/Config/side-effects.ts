import { getPrefixedCdnBaseAsync, isPrefixedCdnBase } from '@uploadcare/cname-prefix/async';
import type { ConfigType } from '../../types/index';
import { deserializeCsv, serializeCsv } from '../../utils/comma-separated';
import { isPromiseLike } from '../../utils/isPromiseLike';
import { DEFAULT_CDN_CNAME } from './initialConfig';

type ConfigKey = keyof ConfigType;
type ConfigValue<TKey extends ConfigKey> = ConfigType[TKey];
type DepKeys<TKey extends ConfigKey> = ReadonlyArray<Exclude<ConfigKey, TKey>>;

type ComputedPropertyArgs<TKey extends ConfigKey, TDeps extends DepKeys<TKey>> = Record<TKey, ConfigValue<TKey>> & {
  [K in TDeps[number]]: ConfigValue<K>;
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

const COMPUTED_PROPERTIES = [
  defineComputedProperty({
    key: 'cameraModes',
    deps: ['enableVideoRecording'] as const,
    fn: ({ cameraModes, enableVideoRecording }) => {
      if (enableVideoRecording === null) {
        return cameraModes;
      }
      let cameraModesCsv = deserializeCsv(cameraModes);
      if (enableVideoRecording && !cameraModesCsv.includes('video')) {
        cameraModesCsv = cameraModesCsv.concat('video');
      } else if (!enableVideoRecording) {
        cameraModesCsv = cameraModesCsv.filter((mode) => mode !== 'video');
      }
      return serializeCsv(cameraModesCsv);
    },
  }),
  defineComputedProperty({
    key: 'cameraModes',
    deps: ['defaultCameraMode'] as const,
    fn: ({ cameraModes, defaultCameraMode }) => {
      if (defaultCameraMode === null) {
        return cameraModes;
      }
      let cameraModesCsv = deserializeCsv(cameraModes);
      cameraModesCsv = cameraModesCsv.sort((a, b) => {
        if (a === defaultCameraMode) return -1;
        if (b === defaultCameraMode) return 1;
        return 0;
      });
      return serializeCsv(cameraModesCsv);
    },
  }),
  defineComputedProperty({
    key: 'cdnCname',
    deps: ['pubkey', 'cdnCnamePrefixed'] as const,
    fn: ({ pubkey, cdnCname, cdnCnamePrefixed }) => {
      if (pubkey && (cdnCname === DEFAULT_CDN_CNAME || isPrefixedCdnBase(cdnCname, cdnCnamePrefixed))) {
        return getPrefixedCdnBaseAsync(pubkey, cdnCnamePrefixed);
      }

      return cdnCname;
    },
  }),
];

type ConfigSetter = <TSetValue extends ConfigKey>(key: TSetValue, value: ConfigValue<TSetValue>) => void;
type ConfigGetter = <TGetValue extends ConfigKey>(key: TGetValue) => ConfigValue<TGetValue>;

type RunSideEffectsOptions<TKey extends ConfigKey> = {
  key: TKey;
  setValue: ConfigSetter;
  getValue: ConfigGetter;
};

const abortControllers = new Map<ConfigKey, AbortController>();

export const runSideEffects = <TKey extends ConfigKey>({ key, setValue, getValue }: RunSideEffectsOptions<TKey>) => {
  for (const computed of COMPUTED_PROPERTIES) {
    if (computed.deps.includes(key)) {
      const args: Partial<Record<ConfigKey, ConfigType[ConfigKey]>> = {
        [computed.key]: getValue(computed.key),
      };

      for (const dep of computed.deps) {
        args[dep] = getValue(dep);
      }
      const abortController = new AbortController();
      abortControllers.get(computed.key)?.abort();
      abortControllers.set(computed.key, abortController);
      const result = computed.fn(args as ComputedPropertyArgs<typeof computed.key, typeof computed.deps>, {
        signal: abortController.signal,
      });
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
            abortControllers.delete(computed.key);
          });
      } else {
        abortControllers.delete(computed.key);
        setValue(computed.key, result);
      }
    }
  }
};
