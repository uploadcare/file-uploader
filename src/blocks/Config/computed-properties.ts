import { getPrefixedCdnBaseAsync, isPrefixedCdnBase } from '@uploadcare/cname-prefix/async';
import { DEFAULT_CDN_CNAME } from '../../abstract/config/initialConfig';
import { logger } from '../../abstract/logger';
import type { ConfigType } from '../../types/index';
import { deserializeCsv, serializeCsv } from '../../utils/comma-separated';
import { isPromiseLike } from '../../utils/isPromiseLike';

const log = logger.scope('computed-properties');

type ConfigKey = keyof ConfigType;
type ConfigValue<TKey extends ConfigKey> = ConfigType[TKey];

export type ConfigSetter = <TSetValue extends ConfigKey>(key: TSetValue, value: ConfigValue<TSetValue>) => void;
export type ConfigGetter = <TGetValue extends ConfigKey>(key: TGetValue) => ConfigValue<TGetValue>;

/** One computed per key: `fn` derives `key` from its current value and `deps`, read through `get`. */
type ComputedProperty = {
  [TKey in ConfigKey]: {
    key: TKey;
    deps: ReadonlyArray<Exclude<ConfigKey, TKey>>;
    fn: (get: ConfigGetter) => ConfigValue<TKey> | Promise<ConfigValue<TKey>>;
  };
}[ConfigKey];

export type ComputedPropertyControllers = Map<ComputedProperty['fn'], AbortController>;

const COMPUTED_PROPERTIES: ComputedProperty[] = [
  {
    key: 'cameraModes',
    deps: ['enableVideoRecording'],
    fn: (get) => {
      const evr = get('enableVideoRecording');
      if (evr === null) {
        return get('cameraModes');
      }
      let cameraModesCsv = deserializeCsv(get('cameraModes'));
      if (evr && !cameraModesCsv.includes('video')) {
        cameraModesCsv = cameraModesCsv.concat('video');
      } else if (!evr) {
        cameraModesCsv = cameraModesCsv.filter((mode) => mode !== 'video');
      }
      return serializeCsv(cameraModesCsv);
    },
  },
  {
    key: 'cameraModes',
    deps: ['defaultCameraMode'],
    fn: (get) => {
      const dcm = get('defaultCameraMode');
      if (dcm === null) {
        return get('cameraModes');
      }
      let cameraModesCsv = deserializeCsv(get('cameraModes'));
      cameraModesCsv = cameraModesCsv.sort((a, b) => {
        if (a === dcm) return -1;
        if (b === dcm) return 1;
        return 0;
      });
      return serializeCsv(cameraModesCsv);
    },
  },
  {
    key: 'cdnCname',
    deps: ['pubkey', 'cdnCnamePrefixed'],
    fn: (get) => {
      const pk = get('pubkey');
      const cname = get('cdnCname');
      const prefixed = get('cdnCnamePrefixed');
      if (pk && (cname === DEFAULT_CDN_CNAME || isPrefixedCdnBase(cname, prefixed))) {
        return getPrefixedCdnBaseAsync(pk, prefixed);
      }

      return cname;
    },
  },
];

/**
 * Union of every config key that any computed property depends on. Changing a
 * key NOT in this set can never affect a computed value — `computeProperty`
 * no-ops for it (no `computed.deps.includes(key)` matches) — so a config host
 * only needs to observe THESE keys to keep computed properties current, not all
 * ~55 config keys. Derived from `COMPUTED_PROPERTIES` so it stays correct as
 * computeds are added or their deps change.
 */
export const computedPropertyDependencyKeys: ReadonlySet<ConfigKey> = new Set(
  COMPUTED_PROPERTIES.flatMap((computed) => computed.deps),
);

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
    if (!computed.deps.includes(key)) continue;

    const abortController = new AbortController();
    // Captured before the computation runs, so an async result can tell whether the value it was derived from is
    // still current. Otherwise a resolution in flight overwrites a value the caller set meanwhile.
    const valueAtStart = getValue(computed.key);

    computationControllers.get(computed.fn)?.abort();
    computationControllers.set(computed.fn, abortController);

    let result: ConfigValue<ConfigKey> | Promise<ConfigValue<ConfigKey>>;
    try {
      result = computed.fn(getValue);
    } catch (error) {
      if (computationControllers.get(computed.fn) === abortController) {
        computationControllers.delete(computed.fn);
      }
      log.error(`Failed to compute value for "${computed.key}"`, error);
      return;
    }
    if (isPromiseLike(result)) {
      result
        .then((resolvedValue) => {
          if (abortController.signal.aborted || getValue(computed.key) !== valueAtStart) {
            return;
          }
          setValue(computed.key, resolvedValue);
        })
        .catch((error) => {
          if (abortController.signal.aborted) {
            return;
          }
          log.error(`Failed to compute value for "${computed.key}"`, error);
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
};
