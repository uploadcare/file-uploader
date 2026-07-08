import { getPrefixedCdnBaseAsync, isSameCdnHost } from '@uploadcare/cname-prefix/async';
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
  /**
   * The value this computed property wrote on its previous run (per Config
   * instance). Lets a property recognize its own output when it is fed back
   * as input and re-derive it, while leaving user-provided values untouched.
   */
  lastComputedValue: unknown;
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

export type ComputedPropertyControllers = Map<ComputedPropertyFn<any, any>, AbortController>;

/** Last value written by each computed property, per Config instance. */
export type ComputedPropertyValues = Map<ComputedPropertyFn<any, any>, unknown>;

const defineComputedProperty = <TKey extends ConfigKey, TDeps extends DepKeys<TKey>>(
  declaration: ComputedPropertyDeclaration<TKey, TDeps>,
): ComputedPropertyDeclaration<TKey, TDeps> => declaration;

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
    fn: ({ pubkey, cdnCname, cdnCnamePrefixed }, { lastComputedValue }) => {
      const pk = pubkey();
      const cname = cdnCname();
      const prefixed = cdnCnamePrefixed();
      // Derive the per-project prefixed base when cdnCname is untouched, is a
      // value this property computed earlier (re-derive on pubkey change), or
      // explicitly targets the prefixed zone apex (e.g. bare `ucarecd.net`).
      // Any other value — including a dedicated domain inside the prefixed
      // zone like `custom.ucarecd.net` — is the user's and is kept verbatim.
      const shouldDerive = cname === DEFAULT_CDN_CNAME || cname === lastComputedValue || isSameCdnHost(cname, prefixed);
      if (pk && shouldDerive) {
        return getPrefixedCdnBaseAsync(pk, prefixed);
      }

      return cname;
    },
  }),
];

type ConfigSetter = <TSetValue extends ConfigKey>(key: TSetValue, value: ConfigValue<TSetValue>) => void;
type ConfigGetter = <TGetValue extends ConfigKey>(key: TGetValue) => ConfigValue<TGetValue>;

type ComputePropertyOptions<TKey extends ConfigKey> = {
  key: TKey;
  setValue: ConfigSetter;
  getValue: ConfigGetter;
  computationControllers: ComputedPropertyControllers;
  computedValues: ComputedPropertyValues;
};

export const computeProperty = <TKey extends ConfigKey>({
  key,
  setValue,
  getValue,
  computationControllers,
  computedValues,
}: ComputePropertyOptions<TKey>) => {
  for (const computed of COMPUTED_PROPERTIES) {
    if (!computed.deps.includes(key)) continue;

    const args: Partial<Record<ConfigKey, () => ConfigType[ConfigKey]>> = {
      [computed.key]: () => getValue(computed.key),
    };

    for (const dep of computed.deps) {
      args[dep] = () => getValue(dep);
    }
    const abortController = new AbortController();

    computationControllers.get(computed.fn)?.abort();
    computationControllers.set(computed.fn, abortController);

    // Record provenance only when the property transformed its input: a value
    // returned verbatim (pass-through) is the user's, not the property's, and
    // must not be recognized as `lastComputedValue` on later runs.
    const inputValue = getValue(computed.key);
    const recordAndSetValue = (value: ConfigValue<typeof computed.key>) => {
      if (value !== inputValue) {
        computedValues.set(computed.fn, value);
      }
      setValue(computed.key, value);
    };

    let result: ConfigValue<typeof computed.key> | Promise<ConfigValue<typeof computed.key>>;
    try {
      result = computed.fn(args as ComputedPropertyArgs<typeof computed.key, typeof computed.deps>, {
        signal: abortController.signal,
        lastComputedValue: computedValues.get(computed.fn),
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
          recordAndSetValue(resolvedValue);
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
      recordAndSetValue(result);
    }
  }
};
