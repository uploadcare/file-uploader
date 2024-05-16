// @ts-check

/** @param {import('../types').SecureUploadsSignatureAndExpire} secureToken */
const isSecureTokenExpired = (secureToken) => {
  const { secureExpire } = secureToken;
  return Date.now() > Number(secureExpire);
};

export class SecureUploadsManager {
  /**
   * @private
   * @type {import('./UploaderBlock.js').UploaderBlock}
   */
  _block;
  /**
   * @private
   * @type {import('../types').SecureUploadsSignatureAndExpire | null}
   */
  _secureToken = null;

  /** @param {import('./UploaderBlock.js').UploaderBlock} block */
  constructor(block) {
    this._block = block;
  }

  /** @returns {Promise<import('../types').SecureUploadsSignatureAndExpire | null>} */
  async getSecureToken() {
    const { secureSignature, secureExpire, secureUploadsSignatureResolver } = this._block.cfg;

    if ((secureSignature || secureExpire) && secureUploadsSignatureResolver) {
      console.warn(
        'Both secureSignature/secureExpire and secureUploadsSignatureResolver are set. secureUploadsSignatureResolver will be used.',
      );
    }

    if (secureUploadsSignatureResolver) {
      this._block.debugPrint('Secure signature resolver is set. Fetching secure token...');

      if (!this._secureToken || isSecureTokenExpired(this._secureToken)) {
        const result = await secureUploadsSignatureResolver();
        this._block.debugPrint('Secure token fetched:', result);

        this._secureToken = result ?? null;
      }

      return this._secureToken;
    }

    if (secureSignature && secureExpire) {
      this._block.debugPrint('Secure signature and expire are set. Using them...', {
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
