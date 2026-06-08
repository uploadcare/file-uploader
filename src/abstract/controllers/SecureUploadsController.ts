import type { SecureUploadsSignatureAndExpire } from '../../types/exported';
import { isSecureTokenExpired } from '../../utils/isSecureTokenExpired';
import type { ConfigController } from './ConfigController';

type SecureCfg = {
  secureSignature?: string;
  secureExpire?: string;
  secureUploadsSignatureResolver?: () => Promise<SecureUploadsSignatureAndExpire | null>;
  secureUploadsExpireThreshold?: number;
  debug?: boolean;
};

/**
 * Resolves the upload-time secure-signature token. Returns either a
 * cached value (still within expiry threshold), a freshly-resolved value
 * from `secureUploadsSignatureResolver`, or the static
 * `secureSignature`/`secureExpire` pair from config. Cache invalidates
 * automatically when the token approaches expiry.
 *
 * Pure logic — no DOM, no Lit. Mirrors v1's `SecureUploadsManager`.
 */
export class SecureUploadsController {
  private _cachedToken: SecureUploadsSignatureAndExpire | null = null;

  public constructor(private _config: ConfigController) {}

  public async getSecureToken(): Promise<SecureUploadsSignatureAndExpire | null> {
    const cfg = this._config.values as SecureCfg;
    const { secureSignature, secureExpire, secureUploadsSignatureResolver, secureUploadsExpireThreshold } = cfg;

    if ((secureSignature || secureExpire) && secureUploadsSignatureResolver) {
      console.warn(
        '[uploadcare] Both `secureSignature`/`secureExpire` and `secureUploadsSignatureResolver` are set. The resolver takes precedence.',
      );
    }

    if (secureUploadsSignatureResolver) {
      const expired =
        !this._cachedToken || isSecureTokenExpired(this._cachedToken, { threshold: secureUploadsExpireThreshold });
      if (expired) {
        try {
          const result = await secureUploadsSignatureResolver();
          if (!result) {
            this._cachedToken = null;
          } else if (!result.secureSignature || !result.secureExpire) {
            console.error('[uploadcare] `secureUploadsSignatureResolver` returned an invalid result:', result);
          } else {
            this._cachedToken = result;
          }
        } catch (err) {
          console.error(
            '[uploadcare] `secureUploadsSignatureResolver` threw. Falling back to the previous cached token.',
            err,
          );
        }
      }
      return this._cachedToken;
    }

    if (secureSignature && secureExpire) {
      return { secureSignature, secureExpire };
    }

    return null;
  }

  public destroy(): void {
    this._cachedToken = null;
  }
}
