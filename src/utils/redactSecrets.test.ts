import { describe, expect, it } from 'vitest';
import { isSecretKey, REDACTED, redactSecrets } from './redactSecrets';

describe('redactSecrets', () => {
  it('replaces credentials and leaves everything else alone', () => {
    const options = {
      publicKey: 'demopublickey',
      authToken: 'eyJ.token.sig',
      secureSignature: 'a-signature',
      secureExpire: '1234567890',
      store: 'auto',
    };

    expect(redactSecrets(options)).toEqual({
      publicKey: 'demopublickey',
      authToken: REDACTED,
      secureSignature: REDACTED,
      // Not a credential on its own: an expiry timestamp.
      secureExpire: '1234567890',
      store: 'auto',
    });
  });

  it('redacts a token function too, which would print as its source', () => {
    const authToken = () => 'eyJ.token.sig';

    expect(redactSecrets({ authToken }).authToken).toBe(REDACTED);
  });

  it('does not touch the original', () => {
    const options = { authToken: 'eyJ.token.sig' };
    redactSecrets(options);

    expect(options.authToken).toBe('eyJ.token.sig');
  });

  it('leaves an absent credential absent rather than redacting nothing', () => {
    expect(redactSecrets({ publicKey: 'k' })).toEqual({ publicKey: 'k' });
    expect(redactSecrets({ authToken: undefined })).toEqual({ authToken: undefined });
  });

  it('knows which keys are secret', () => {
    expect(isSecretKey('authToken')).toBe(true);
    expect(isSecretKey('secureSignature')).toBe(true);
    expect(isSecretKey('secureExpire')).toBe(false);
    expect(isSecretKey('pubkey')).toBe(false);
  });
});
