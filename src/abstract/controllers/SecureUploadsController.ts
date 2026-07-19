import type { SecureUploadsSignatureAndExpire } from '../../types/index';
import { isSecureTokenExpired } from '../../utils/isSecureTokenExpired';
import { inject } from '../di/inject';
import { logger } from '../logger';
import { ConfigController } from './ConfigController';
import { UploadHostBridge } from './UploadHostBridge';

/**
 * DOM-free secure-uploads engine — a faithful port of v1's `SecureUploadsManager`.
 *
 * Same resolver-vs-static precedence, same token caching with
 * expire-threshold-driven refresh, same warning/error/debug output (debug now
 * via the centralized `logger`). Container-resolved (M-god step 5): its
 * `ConfigController` peer and the `UploadHostBridge` (for the telemetry
 * `onResolverError` sink) are `@inject`-ed, so it constructs zero-arg without a
 * DOM and is unit testable in isolation.
 */
export class SecureUploadsController {
  @inject(ConfigController) private readonly _config!: ConfigController;
  @inject(UploadHostBridge) private readonly _host!: UploadHostBridge;
  private _secureToken: SecureUploadsSignatureAndExpire | null = null;

  public async getSecureToken(): Promise<SecureUploadsSignatureAndExpire | null> {
    const { secureSignature, secureExpire, secureUploadsSignatureResolver, secureUploadsExpireThreshold } =
      this._config.values;
    if ((secureSignature || secureExpire) && secureUploadsSignatureResolver) {
      logger.warn(
        'Both secureSignature/secureExpire and secureUploadsSignatureResolver are set. secureUploadsSignatureResolver will be used.',
      );
    }

    if (secureUploadsSignatureResolver) {
      if (!this._secureToken || isSecureTokenExpired(this._secureToken, { threshold: secureUploadsExpireThreshold })) {
        if (!this._secureToken) {
          logger.debug('Secure signature is not set yet.');
        } else {
          logger.debug('Secure signature is expired. Resolving a new one...');
        }
        try {
          const result = await secureUploadsSignatureResolver();
          if (!result) {
            logger.debug('Secure signature resolver returned nothing.');
            this._secureToken = null;
          } else if (!result.secureSignature || !result.secureExpire) {
            logger.error('Secure signature resolver returned an invalid result:', result);
          } else {
            logger.debug('Secure signature resolved:', result);
            logger.debug('Secure signature will expire in', new Date(Number(result.secureExpire) * 1000).toISOString());
            this._secureToken = result;
          }
        } catch (err) {
          logger.error('Secure signature resolving failed. Falling back to the previous one.', err);
          this._host.onResolverError(
            err,
            'secureUploadsSignatureResolver. Secure signature resolving failed. Falling back to the previous one.',
          );
        }
      }

      return this._secureToken;
    }

    if (secureSignature && secureExpire) {
      logger.debug('Secure signature and expire are set. Using them...', {
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
