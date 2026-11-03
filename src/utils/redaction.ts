import type { FileFromOptions } from '@uploadcare/upload-client';
import type { ConfigType } from '../types/exported';

/**
 * Config and upload-client option keys whose value is a credential.
 *
 * They must not reach a console, a log or a telemetry payload: `authToken` is a
 * bearer token and `secureSignature` authorizes uploads until it expires, so
 * either one is enough to upload to the project on its own.
 *
 * The names are shared between `ConfigType` and upload-client's options, which
 * is what lets one list cover both — pinned by `satisfies`, so a rename on
 * either side fails to compile rather than silently unredacting a credential.
 */
export const SECRET_KEYS = ['authToken', 'secureSignature'] as const satisfies readonly (keyof ConfigType &
  keyof FileFromOptions)[];

/**
 * Keys whose value is not a credential but is private: the rest of the signing and delivery setup, the integrator's
 * metadata, and what identifies a file (its name, uuid, CDN/S3 URL, path, the `File` itself) in an entry, its
 * `fileInfo` or a collection's group. Fine in this page's console; never sent anywhere.
 */
const PRIVATE_KEYS: readonly string[] = [
  'secureExpire',
  'secureDeliveryProxy',
  'secureUploadsSignatureResolver',
  'secureDeliveryProxyUrlResolver',
  'metadata',
  'name',
  'originalFilename',
  'uuid',
  'cdnUrl',
  'cdnUrlModifiers',
  'externalUrl',
  'fullPath',
  'file',
  's3Url',
  's3Bucket',
] satisfies readonly (keyof ConfigType | (string & {}))[];

/** Where a value goes: `log` stays in this page's console, `send` leaves the page (telemetry). */
export type RedactionTarget = 'log' | 'send';

export const REDACTED = '<redacted>';

const isRedactedKey = (key: string, target: RedactionTarget): boolean =>
  (SECRET_KEYS as readonly string[]).includes(key) || (target === 'send' && PRIVATE_KEYS.includes(key));

/** `value`, or {@link REDACTED} when `key` must not reach `target`. An unset value (null, undefined, '') stays as is. */
export const redactValue = (key: string, value: unknown, target: RedactionTarget = 'log'): unknown =>
  value === null || value === undefined || value === '' || !isRedactedKey(key, target) ? value : REDACTED;

const isPlainObject = (value: object): boolean => {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

/**
 * A deep copy of `value` with every key that must not reach `target` redacted, at any depth.
 * - `log`: copies arrays and plain objects, so a logged signal, `File` or class keeps showing as itself.
 * - `send`: copies every object, as its own enumerable properties (getters read now): it is serialized anyway, and an
 *   uploaded file's info or group is a class instance.
 * A reference back to an object being copied is dropped.
 */
export const redact = <T>(value: T, target: RedactionTarget = 'log'): T => copy(value, target, new Set()) as T;

const copy = (value: unknown, target: RedactionTarget, ancestors: Set<object>): unknown => {
  if (value === null || typeof value !== 'object') return value;
  if (target === 'log' && !Array.isArray(value) && !isPlainObject(value)) return value;
  if (ancestors.has(value)) return undefined;
  ancestors.add(value);
  let result: unknown;
  if (Array.isArray(value)) {
    result = value.map((item) => copy(item, target, ancestors));
  } else {
    const entries = Object.entries(value).map(([key, item]) => {
      const redacted = redactValue(key, item, target);
      return [key, redacted === REDACTED ? REDACTED : copy(item, target, ancestors)];
    });
    result = Object.fromEntries(entries);
  }
  // Only the current path counts: the same entry in `allEntries` and `successEntries` is copied both times.
  ancestors.delete(value);
  return result;
};
