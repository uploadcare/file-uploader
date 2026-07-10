import type { SecureUploadsSignatureAndExpire } from '../../types/index';
import { isSecureTokenExpired } from '../../utils/isSecureTokenExpired';
import type { ConfigController } from './ConfigController';

export type SecureUploadsControllerDeps = {
  config: ConfigController;
  /** Optional telemetry hook for a signature resolver that throws. */
  onResolverError?: (error: unknown, context: string) => void;
  /**
   * Debug logger — wired to the block's `debugPrint` at the DOM boundary (so it
   * honours the `debug` config). Defaults to a no-op for standalone use.
   */
  debug?: (...args: unknown[]) => void;
};

/**
 * DOM-free secure-uploads engine — a faithful port of v1's `SecureUploadsManager`.
 *
 * Same resolver-vs-static precedence, same token caching with
 * expire-threshold-driven refresh, same warning/error/debug output. The only
 * difference is that collaborators (config, telemetry, debug) are injected
 * rather than pulled from the shared context — so it constructs without a DOM
 * (side-effect-free, as M0 required) and is unit testable in isolation.
 */
export class SecureUploadsController {
  private _config: ConfigController;
  private _onResolverError?: (error: unknown, context: string) => void;
  private _debug: (...args: unknown[]) => void;
  private _secureToken: SecureUploadsSignatureAndExpire | null = null;

  public constructor(deps: SecureUploadsControllerDeps) {
    this._config = deps.config;
    this._onResolverError = deps.onResolverError;
    this._debug = deps.debug ?? (() => {});
  }

  public async getSecureToken(): Promise<SecureUploadsSignatureAndExpire | null> {
    const { secureSignature, secureExpire, secureUploadsSignatureResolver, secureUploadsExpireThreshold } =
      this._config.values;
    if ((secureSignature || secureExpire) && secureUploadsSignatureResolver) {
      console.warn(
        'Both secureSignature/secureExpire and secureUploadsSignatureResolver are set. secureUploadsSignatureResolver will be used.',
      );
    }

    if (secureUploadsSignatureResolver) {
      if (!this._secureToken || isSecureTokenExpired(this._secureToken, { threshold: secureUploadsExpireThreshold })) {
        if (!this._secureToken) {
          this._debug('Secure signature is not set yet.');
        } else {
          this._debug('Secure signature is expired. Resolving a new one...');
        }
        try {
          const result = await secureUploadsSignatureResolver();
          if (!result) {
            this._debug('Secure signature resolver returned nothing.');
            this._secureToken = null;
          } else if (!result.secureSignature || !result.secureExpire) {
            console.error('Secure signature resolver returned an invalid result:', result);
          } else {
            this._debug('Secure signature resolved:', result);
            this._debug('Secure signature will expire in', new Date(Number(result.secureExpire) * 1000).toISOString());
            this._secureToken = result;
          }
        } catch (err) {
          console.error('Secure signature resolving failed. Falling back to the previous one.', err);
          this._onResolverError?.(
            err,
            'secureUploadsSignatureResolver. Secure signature resolving failed. Falling back to the previous one.',
          );
        }
      }

      return this._secureToken;
    }

    if (secureSignature && secureExpire) {
      this._debug('Secure signature and expire are set. Using them...', {
        secureSignature,
        secureExpire,
      });

      return {
        secureSignature,
        secureExpire,
      };
    }

    return null;
  }

  public destroy(): void {
    this._secureToken = null;
  }
}
