/**
 * Config and upload-client option keys whose value is a credential.
 *
 * They must not reach a console, a log or a telemetry payload: `authToken` is a
 * bearer token and `secureSignature` authorizes uploads until it expires, so
 * either one is enough to upload to the project on its own.
 *
 * The names are shared between `ConfigType` and upload-client's options, which
 * is what lets one list cover both.
 */
export const SECRET_KEYS = ['authToken', 'secureSignature'] as const;

export const REDACTED = '<redacted>';

export const isSecretKey = (key: string): boolean => (SECRET_KEYS as readonly string[]).includes(key);

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
