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

export const REDACTED = '<redacted>';

export const isSecretKey = (key: string): boolean => (SECRET_KEYS as readonly string[]).includes(key);

/**
 * File and owner identifying keys of the uploader's output data (an entry, its `fileInfo`, a collection's group):
 * names, uuids, CDN/S3 URLs, paths, the `File` itself and integrator metadata. Not credentials, but private.
 */
export const PRIVATE_DATA_KEYS = [
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
  'metadata',
] as const;

/** A shallow copy with every credential replaced, for logging or sending. */
export const redactSecrets = <T extends Record<string, unknown>>(source: T): T => {
  const result = { ...source };
  for (const key of SECRET_KEYS) {
    if (result[key] !== undefined && result[key] !== null) {
      (result as Record<string, unknown>)[key] = REDACTED;
    }
  }
  return result;
};

/**
 * A plain deep copy of `value` with the value of every `keys` key replaced, at any depth, for sending data that
 * nests (an output collection's entries). Functions are dropped, and so is a reference back to an object being copied.
 */
export const redactDeep = (value: unknown, keys: readonly string[], ancestors = new Set<object>()): unknown => {
  if (typeof value === 'function') return undefined;
  if (value === null || typeof value !== 'object') return value;
  if (ancestors.has(value)) return undefined;
  ancestors.add(value);
  let result: unknown;
  if (Array.isArray(value)) {
    result = value.map((item) => redactDeep(item, keys, ancestors));
  } else {
    const copy: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (typeof item === 'function') continue;
      copy[key] =
        keys.includes(key) && item !== null && item !== undefined ? REDACTED : redactDeep(item, keys, ancestors);
    }
    result = copy;
  }
  // Only the current path counts: the same entry in `allEntries` and `successEntries` is copied both times.
  ancestors.delete(value);
  return result;
};
