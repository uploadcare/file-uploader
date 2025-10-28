import type { SecureUploadsSignatureAndExpire } from '../../types/index';
import { isSecureTokenExpired } from '../../utils/isSecureTokenExpired';
import type { UploaderBlock } from '../UploaderBlock';

export class SecureUploadsManager {
  private readonly _block: UploaderBlock;
  private _secureToken: SecureUploadsSignatureAndExpire | null = null;

  constructor(block: UploaderBlock) {
    this._block = block;
  }

  private _debugPrint(...args: unknown[]): void {
    this._block.debugPrint('[secure-uploads]', ...args);
  }

  async getSecureToken(): Promise<SecureUploadsSignatureAndExpire | null> {
    const { secureSignature, secureExpire, secureUploadsSignatureResolver } = this._block.cfg;

    if ((secureSignature || secureExpire) && secureUploadsSignatureResolver) {
      console.warn(
        'Both secureSignature/secureExpire and secureUploadsSignatureResolver are set. secureUploadsSignatureResolver will be used.',
      );
    }

    if (secureUploadsSignatureResolver) {
      if (
        !this._secureToken ||
        isSecureTokenExpired(this._secureToken, { threshold: this._block.cfg.secureUploadsExpireThreshold })
      ) {
        if (!this._secureToken) {
          this._debugPrint('Secure signature is not set yet.');
        } else {
          this._debugPrint('Secure signature is expired. Resolving a new one...');
        }
        try {
          const result = await secureUploadsSignatureResolver();
          if (!result) {
            this._debugPrint('Secure signature resolver returned nothing.');
            this._secureToken = null;
          } else if (!result.secureSignature || !result.secureExpire) {
            console.error('Secure signature resolver returned an invalid result:', result);
          } else {
            this._debugPrint('Secure signature resolved:', result);
            this._debugPrint(
              'Secure signature will expire in',
              new Date(Number(result.secureExpire) * 1000).toISOString(),
            );
            this._secureToken = result;
          }
        } catch (err) {
          console.error('Secure signature resolving failed. Falling back to the previous one.', err);
          this._block.telemetryManager.sendEventError(
            err,
            'secureUploadsSignatureResolver. Secure signature resolving failed. Falling back to the previous one.',
          );
        }
      }

      return this._secureToken;
    }

    if (secureSignature && secureExpire) {
      this._debugPrint('Secure signature and expire are set. Using them...', {
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
}
