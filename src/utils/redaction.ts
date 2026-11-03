import type { ConfigType } from '../types/exported';

/**
 * Keys whose value must not leave the page: credentials (`authToken` is a bearer token, `secureSignature` authorizes
 * uploads until it expires), the rest of the signing and delivery setup, the integrator's metadata, and what identifies
 * a file (its name, uuid, CDN/S3 URL, path, the `File` itself) in an entry, its `fileInfo` or a collection's group.
 *
 * Only data sent away is redacted (telemetry). The console keeps them: they are runtime values the page already holds.
 */
const PRIVATE_KEYS: readonly string[] = [
  'authToken',
  'secureSignature',
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

export const REDACTED = '<redacted>';

/** An unset value (null, undefined, '') stays as is, so the data still shows the option is unused. */
const isUnset = (value: unknown): boolean => value === null || value === undefined || value === '';

/**
 * A deep copy of `value` with every {@link PRIVATE_KEYS} value replaced by {@link REDACTED}, at any depth, for data
 * that leaves the page. Every object is copied as its own enumerable properties (getters are read now): it is
 * serialized anyway, and an uploaded file's info or group is a class instance. A reference back to an object being
 * copied is dropped.
 */
export const redact = <T>(value: T): T => copy(value, new Set()) as T;

const copy = (value: unknown, ancestors: Set<object>): unknown => {
  if (value === null || typeof value !== 'object') return value;
  if (ancestors.has(value)) return undefined;
  ancestors.add(value);
  const result = Array.isArray(value)
    ? value.map((item) => copy(item, ancestors))
    : Object.fromEntries(
        Object.entries(value).map(([key, item]) => [
          key,
          PRIVATE_KEYS.includes(key) && !isUnset(item) ? REDACTED : copy(item, ancestors),
        ]),
      );
  // Only the current path counts: the same entry in `allEntries` and `successEntries` is copied both times.
  ancestors.delete(value);
  return result;
};
