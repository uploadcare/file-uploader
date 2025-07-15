// @ts-check

// TODO: Here is troubles with tsd: it can't resolve types from `@uploadcare/cname-prefix/async` due to unsupported bundler moduleResolution.
// @ts-ignore
import { getPrefixedCdnBaseAsync, isPrefixedCdnBase } from '@uploadcare/cname-prefix/async';
import { deserializeCsv, serializeCsv } from '../utils/comma-separated.js';
import { DEFAULT_CDN_CNAME } from './initialConfig.js';
import { isPromiseLike } from '../../utils/isPromiseLike.js';

/**
 * @template {keyof import('../../types').ConfigType} TKey
 * @template {Exclude<keyof import('../../types').ConfigType, TKey>[]} TDeps
 * @typedef {Object} ComputedPropertyDeclaration
 * @property {TKey} key
 * @property {TDeps} deps
 * @property {(
 *   args: Record<TKey, import('../../types').ConfigType[TKey]> & {
 *     [K in TDeps[number]]: import('../../types').ConfigType[K];
 *   },
 * ) => import('../../types').ConfigType[TKey] | Promise<import('../../types').ConfigType[TKey]>} fn
 */

/**
 * @template {keyof import('../../types').ConfigType} TKey
 * @template {Exclude<keyof import('../../types').ConfigType, TKey>[]} TDeps
 * @param {ComputedPropertyDeclaration<TKey, TDeps>} declaration
 */
function defineComputedProperty(declaration) {
  return declaration;
}

const COMPUTED_PROPERTIES = [
  defineComputedProperty({
    key: 'cameraModes',
    deps: ['enableVideoRecording'],
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
    deps: ['defaultCameraMode'],
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
    deps: ['pubkey', 'cdnCnamePrefixed'],
    fn: ({ pubkey, cdnCname, cdnCnamePrefixed }) => {
      if (pubkey && (cdnCname === DEFAULT_CDN_CNAME || isPrefixedCdnBase(cdnCname, cdnCnamePrefixed))) {
        return getPrefixedCdnBaseAsync(pubkey, cdnCnamePrefixed);
      }

      return cdnCname;
    },
  }),
];

/**
 * @template {keyof import('../../types').ConfigType} T
 * @param {{
 *   key: T;
 *   setValue: <TSetValue extends keyof import('../../types').ConfigType>(
 *     key: TSetValue,
 *     value: import('../../types').ConfigType[TSetValue],
 *   ) => void;
 *   getValue: <TGetValue extends keyof import('../../types').ConfigType>(
 *     key: TGetValue,
 *   ) => import('../../types').ConfigType[TGetValue];
 * }} options
 */
export const runSideEffects = ({ key, setValue, getValue }) => {
  for (const computed of COMPUTED_PROPERTIES) {
    if (computed.deps.includes(key)) {
      const args = {
        [computed.key]: getValue(computed.key),
        ...computed.deps.reduce(
          (acc, dep) => ({
            ...acc,
            [dep]: getValue(dep),
          }),
          /**
           * @type {Record<typeof computed.key, import('../../types').ConfigType[typeof computed.key]> & {
           *   [K in (typeof computed.deps)[number]]: import('../../types').ConfigType[K];
           * }}
           */ ({}),
        ),
      };
      const result = computed.fn(args);
      if (isPromiseLike(result)) {
        const prevValue = getValue(computed.key);
        result
          .then((resolvedValue) => {
            const currentValue = getValue(computed.key);
            if (currentValue === prevValue) {
              setValue(computed.key, resolvedValue);
            }
          })
          .catch((error) => {
            console.error(`Failed to compute value for "${computed.key}"`, error);
          });
      } else {
        setValue(computed.key, result);
      }
    }
  }
};
