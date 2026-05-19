import { SharedInstance } from '../../lit/shared-instances';
import type { SecureUploadsSignatureAndExpire } from '../../types/index';
import { isSecureTokenExpired } from '../../utils/isSecureTokenExpired';

export class SecureUploadsManager extends SharedInstance {
  private _secureToken: SecureUploadsSignatureAndExpire | null = null;

  public async getSecureToken(): Promise<SecureUploadsSignatureAndExpire | null> {
    const { secureSignature, secureExpire, secureUploadsSignatureResolver, secureUploadsExpireThreshold } = this._cfg;
    if ((secureSignature || secureExpire) && secureUploadsSignatureResolver) {
      console.warn(
        'Both secureSignature/secureExpire and secureUploadsSignatureResolver are set. secureUploadsSignatureResolver will be used.',
      );
    }

    if (secureUploadsSignatureResolver) {
      if (!this._secureToken || isSecureTokenExpired(this._secureToken, { threshold: secureUploadsExpireThreshold })) {
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
          this._sharedInstancesBag.telemetryManager.sendEventError(
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

  public override destroy(): void {
    super.destroy();
    this._secureToken = null;
  }
}
