import { describe, expect, it } from 'vitest';
import { REDACTED, redact, redactValue } from './redaction';

describe('redact', () => {
  it('replaces credentials and leaves everything else alone', () => {
    const options = {
      publicKey: 'demopublickey',
      authToken: 'eyJ.token.sig',
      secureSignature: 'a-signature',
      secureExpire: '1234567890',
      store: 'auto',
    };

    expect(redact(options, 'log')).toEqual({
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

    expect(redact({ authToken }, 'log').authToken).toBe(REDACTED);
  });

  it('does not touch the original', () => {
    const options = { authToken: 'eyJ.token.sig', nested: { secureSignature: 's' } };
    redact(options, 'send');

    expect(options).toEqual({ authToken: 'eyJ.token.sig', nested: { secureSignature: 's' } });
  });

  it('leaves an absent or empty credential as it is rather than redacting nothing', () => {
    expect(redact({ publicKey: 'k' }, 'log')).toEqual({ publicKey: 'k' });
    expect(redact({ authToken: undefined }, 'log')).toEqual({ authToken: undefined });
    expect(redact({ authToken: null, secureSignature: '' }, 'send')).toEqual({ authToken: null, secureSignature: '' });
  });

  it('knows which keys are secret', () => {
    expect(redactValue('authToken', 't')).toBe(REDACTED);
    expect(redactValue('secureSignature', 's')).toBe(REDACTED);
    expect(redactValue('secureExpire', '1')).toBe('1');
    expect(redactValue('pubkey', 'k')).toBe('k');
  });

  it('keeps private data in a log but not in what is sent', () => {
    const entry = { name: 'cat.png', size: 70, metadata: { userId: 'u1' }, uuid: 'abc' };

    expect(redact(entry, 'log')).toEqual(entry);
    expect(redact(entry, 'send')).toEqual({ name: REDACTED, size: 70, metadata: REDACTED, uuid: REDACTED });
    expect(redactValue('secureExpire', '1', 'send')).toBe(REDACTED);
  });

  it('redacts at any depth, including inside class instances, when sending', () => {
    class Info {
      public uuid = 'abc';
      public isImage = true;
    }
    const state = { status: 'success', allEntries: [{ name: 'cat.png', fileInfo: new Info() }], group: null };

    expect(redact(state, 'send')).toEqual({
      status: 'success',
      allEntries: [{ name: REDACTED, fileInfo: { uuid: REDACTED, isImage: true } }],
      group: null,
    });
  });

  it('copies an object reached twice both times, and drops a reference back to its own ancestor', () => {
    const entry: Record<string, unknown> = { name: 'cat.png', size: 1 };
    entry.self = entry;
    const sent = redact({ allEntries: [entry], successEntries: [entry] }, 'send');

    expect(sent.allEntries[0]).toEqual({ name: REDACTED, size: 1, self: undefined });
    expect(sent.successEntries[0]).toEqual({ name: REDACTED, size: 1, self: undefined });
  });

  it('leaves class instances in a log as they are', () => {
    const signal = new AbortController().signal;

    expect(redact({ signal, authToken: 't' }, 'log').signal).toBe(signal);
  });
});
