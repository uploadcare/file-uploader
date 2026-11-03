import { describe, expect, it } from 'vitest';
import { REDACTED, redact } from './redaction';

describe('redact', () => {
  it('replaces credentials and the signing setup, and leaves everything else alone', () => {
    const options = {
      publicKey: 'demopublickey',
      authToken: 'eyJ.token.sig',
      secureSignature: 'a-signature',
      secureExpire: '1234567890',
      store: 'auto',
    };

    expect(redact(options)).toEqual({
      publicKey: 'demopublickey',
      authToken: REDACTED,
      secureSignature: REDACTED,
      secureExpire: REDACTED,
      store: 'auto',
    });
  });

  it('redacts a token function too, which would serialize as nothing', () => {
    const authToken = () => 'eyJ.token.sig';

    expect(redact({ authToken }).authToken).toBe(REDACTED);
  });

  it('does not touch the original', () => {
    const options = { authToken: 'eyJ.token.sig', nested: { secureSignature: 's' } };
    redact(options);

    expect(options).toEqual({ authToken: 'eyJ.token.sig', nested: { secureSignature: 's' } });
  });

  it('leaves an absent or empty value as it is rather than redacting nothing', () => {
    expect(redact({ publicKey: 'k' })).toEqual({ publicKey: 'k' });
    expect(redact({ authToken: undefined })).toEqual({ authToken: undefined });
    expect(redact({ authToken: null, secureSignature: '' })).toEqual({ authToken: null, secureSignature: '' });
  });

  it("redacts a file's identity and metadata", () => {
    const entry = { name: 'cat.png', size: 70, metadata: { userId: 'u1' }, uuid: 'abc' };

    expect(redact(entry)).toEqual({ name: REDACTED, size: 70, metadata: REDACTED, uuid: REDACTED });
  });

  it('redacts at any depth, including inside class instances', () => {
    class Info {
      public uuid = 'abc';
      public isImage = true;
    }
    const state = { status: 'success', allEntries: [{ name: 'cat.png', fileInfo: new Info() }], group: null };

    expect(redact(state)).toEqual({
      status: 'success',
      allEntries: [{ name: REDACTED, fileInfo: { uuid: REDACTED, isImage: true } }],
      group: null,
    });
  });

  it('copies an object reached twice both times, and drops a reference back to its own ancestor', () => {
    const entry: Record<string, unknown> = { name: 'cat.png', size: 1 };
    entry.self = entry;
    const sent = redact({ allEntries: [entry], successEntries: [entry] });

    expect(sent.allEntries[0]).toEqual({ name: REDACTED, size: 1, self: undefined });
    expect(sent.successEntries[0]).toEqual({ name: REDACTED, size: 1, self: undefined });
  });
});
