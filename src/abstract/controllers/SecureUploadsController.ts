import type { SecureUploadsSignatureAndExpire } from '../../types/index';
import { isSecureTokenExpired } from '../../utils/isSecureTokenExpired';
import { controllerLogger } from '../controllerLogger';
import { inject } from '../di/inject';
import { ConfigController } from './ConfigController';
import { UploadHostBridge } from './UploadHostBridge';

/**
 * DOM-free secure-uploads engine — a faithful port of v1's `SecureUploadsManager`.
 *
 * Same resolver-vs-static precedence, same token caching with
 * expire-threshold-driven refresh, same warning/error/debug output (debug now
 * per-ctx gated via a scoped `logger`, keyed off this ctx's `debug` config).
 * Container-resolved (M-god step 5): its
 * `ConfigController` peer and the `UploadHostBridge` (for the telemetry
 * `onResolverError` sink) are `@inject`-ed, so it constructs zero-arg without a
 * DOM and is unit testable in isolation.
 */
export class SecureUploadsController {
  @inject(ConfigController) private readonly _config!: ConfigController;
  @inject(UploadHostBridge) private readonly _host!: UploadHostBridge;
  private _secureToken: SecureUploadsSignatureAndExpire | null = null;

  // Per-ctx gated logger: the verbose tier prints only when THIS ctx's `debug`
  // config is on; ctx-name + gate resolve lazily at log time via the container
  // that built this instance.
  private readonly _log = controllerLogger(this, 'secure-uploads');

  public async getSecureToken(): Promise<SecureUploadsSignatureAndExpire | null> {
    const { secureSignature, secureExpire, secureUploadsSignatureResolver, secureUploadsExpireThreshold } =
      this._config.values;
    if ((secureSignature || secureExpire) && secureUploadsSignatureResolver) {
      this._log.warn(
        'Both secureSignature/secureExpire and secureUploadsSignatureResolver are set. secureUploadsSignatureResolver will be used.',
      );
    }

    if (secureUploadsSignatureResolver) {
      if (!this._secureToken || isSecureTokenExpired(this._secureToken, { threshold: secureUploadsExpireThreshold })) {
        try {
          if (!this._secureToken) {
            this._log.debug('Secure signature is not set yet.');
          } else {
            this._log.debug('Secure signature is expired. Resolving a new one...');
          }
          const result = await secureUploadsSignatureResolver();
          if (!result) {
            this._log.debug('Secure signature resolver returned nothing.');
            this._secureToken = null;
          } else if (!result.secureSignature || !result.secureExpire) {
            this._log.error('Secure signature resolver returned an invalid result:', result);
          } else {
            this._log.debug('Secure signature resolved:', { ...result, secureSignature: '[redacted]' });
            this._log.debug(
              'Secure signature will expire in',
              new Date(Number(result.secureExpire) * 1000).toISOString(),
            );
            this._secureToken = result;
          }
        } catch (err) {
          this._log.error('Secure signature resolving failed. Falling back to the previous one.', err);
          this._host.onResolverError(
            err,
            'secureUploadsSignatureResolver. Secure signature resolving failed. Falling back to the previous one.',
          );
        }
      }

      return this._secureToken;
    }

    if (secureSignature && secureExpire) {
      this._log.debug('Secure signature and expire are set. Using them...', {
        secureSignature: '[redacted]',
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
