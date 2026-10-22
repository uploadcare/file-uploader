import { AuthTokenResolverError } from '@uploadcare/upload-client';
import { assert, describe, expect, it, vi } from 'vitest';
import { commands } from 'vitest/browser';
import type { Config } from '@/index';
import { IMAGE } from '~/tests/fixtures/files';
import type { AuthTokenKind } from '~/tests/utils/commands';
import { resetEmulator } from '~/tests/utils/emulator.browser';
import { inCtx, renderSolution } from '~/tests/utils/render-solution';
import '~/types/jsx';

/**
 * `authToken` as a credential rather than as an option: the two questions that
 * only matter because it is a bearer token.
 *
 * Where it must not appear — the DOM, the console — and whether Upload API
 * accepts what the uploader sends.
 * `upload-client-options.e2e` covers the value reaching the upload call, and
 * `upload-errors.e2e` how a failure is classified.
 *
 * The uploads need a project with Signed Uploads enabled, which rejects every
 * unsigned request: one the emulator turns it on for, a real one when `E2E_NET=live`.
 * Tokens are minted by a Node-side command, since the project secret key must
 * never reach the page. A live run without its credentials skips them, except
 * under `E2E_REQUIRE_SECURE_UPLOADS=1` (the CI step that runs them live), where
 * the missing credentials fail the whole file.
 */

const TOKEN = 'eyJ.a-real-looking-token.sig';

/**
 * Whether this run can mint tokens: always against the emulator, live only with the project's keys set. Under
 * `E2E_REQUIRE_SECURE_UPLOADS=1` the probe throws instead, which fails the whole file.
 */
const hasCredentials = (await commands.mintSecureUploadsCredentials()) !== null;

/** Mints credentials, and against the emulator starts the test on a session whose project enforces them. */
const signedProject = async (kind?: AuthTokenKind) => {
  const credentials = await commands.mintSecureUploadsCredentials(kind);
  if (!credentials) throw new Error('No Signed Uploads credentials, though the probe minted some');
  (await resetEmulator())?.use('signedUploads', { publicKey: credentials.publicKey });
  return credentials;
};

const entry = (api: Awaited<ReturnType<typeof renderSolution>>['api']) => api.getOutputCollectionState().allEntries[0];

describe('authToken is not exposed', () => {
  it('is never reflected back into the DOM', async () => {
    // A resolver has no attribute form, and a bearer credential should not be
    // mirrored into the page where it is trivially readable.
    const { ctxName } = await renderSolution('regular', {});
    const config = inCtx<Config>('uc-config', ctxName);

    config.authToken = TOKEN;
    await vi.waitFor(() => expect(config.authToken).toBe(TOKEN));

    expect(config.getAttribute('auth-token')).toBeNull();
  });

  it.skipIf(!hasCredentials)('stays out of the debug log', async () => {
    const credentials = await signedProject();

    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { ctxName, api } = await renderSolution(
      'regular',
      { debug: true, store: false },
      { pubkey: credentials.publicKey },
    );
    inCtx<Config>('uc-config', ctxName).authToken = credentials.authToken;
    api.addFileFromObject(IMAGE.PIXEL);
    api.uploadAll();
    await expect.poll(() => entry(api)?.status, { timeout: 20_000 }).toBe('success');

    // Debug mode prints the config assignment and the upload options; both
    // used to carry the token verbatim.
    const printed = log.mock.calls.map((args) => JSON.stringify(args)).join('\n');
    expect(printed).toContain('authToken');
    expect(printed).not.toContain(credentials.authToken);
  });
});

describe.skipIf(!hasCredentials)('authToken against Upload API', () => {
  it('uploads a file the project would otherwise refuse', async () => {
    const credentials = await signedProject();

    const { api } = await renderSolution(
      'regular',
      { authToken: credentials.authToken, store: false },
      { pubkey: credentials.publicKey },
    );
    api.addFileFromObject(IMAGE.PIXEL);
    api.uploadAll();

    await expect.poll(() => entry(api)?.status, { timeout: 20_000 }).toBe('success');
    expect(entry(api).uuid).toEqual(expect.any(String));
    expect(entry(api).cdnUrl).toContain(entry(api).uuid);
  });

  it('fails the upload when the same project gets no token', async () => {
    // Without this the rest proves nothing: a project that does not enforce
    // signed uploads would accept every upload below, token or not.
    const credentials = await signedProject();

    const { api } = await renderSolution('regular', { store: false }, { pubkey: credentials.publicKey });
    api.addFileFromObject(IMAGE.PIXEL);
    api.uploadAll();

    await expect.poll(() => entry(api)?.status, { timeout: 20_000 }).toBe('failed');
    const [error] = entry(api).errors;

    expect(error).toMatchObject({ type: 'UPLOAD_ERROR', payload: { error: { code: 'SignatureRequiredError' } } });
  });

  it('uploads with a token function, asking it once for the whole upload', async () => {
    const credentials = await signedProject();

    // upload-client asks before every request, so without the uploader's cache
    // this would call an app's token endpoint several times for one file.
    let calls = 0;
    const { ctxName, api } = await renderSolution('regular', { store: false }, { pubkey: credentials.publicKey });
    inCtx<Config>('uc-config', ctxName).authToken = () => {
      calls += 1;
      return credentials.authToken;
    };

    api.addFileFromObject(IMAGE.PIXEL);
    api.uploadAll();

    await expect.poll(() => entry(api)?.status, { timeout: 20_000 }).toBe('success');
    expect(calls).toBe(1);
  });

  it('uploads with a provider, so a caller can bring their own cache', async (ctx) => {
    const credentials = await commands.mintSecureUploadsCredentials();
    if (!credentials) return ctx.skip();

    // The `{ getToken, invalidate }` shape, which an `AuthTokenCache` from
    // `@uploadcare/signed-uploads/client` already satisfies. The config
    // validator used to reject it and fall back to no token at all, so the
    // upload went out unsigned and this project refused it.
    let calls = 0;
    let invalidated = 0;
    const { ctxName, api } = await renderSolution('regular', { store: false }, { pubkey: credentials.publicKey });
    inCtx<Config>('uc-config', ctxName).authToken = {
      getToken: () => {
        calls += 1;
        return credentials.authToken;
      },
      invalidate: () => {
        invalidated += 1;
      },
    };

    api.addFileFromObject(IMAGE.PIXEL);
    api.uploadAll();

    await expect.poll(() => entry(api)?.status, { timeout: 20_000 }).toBe('success');
    // A provider owns its own caching, so the uploader does not add one and
    // the call count is the provider's business. That it was asked at all is
    // what proves the value survived validation.
    expect(calls).toBeGreaterThan(0);
    // Nothing refused this token, so nothing should have dropped it.
    expect(invalidated).toBe(0);
  });

  const rejectedTokens = [
    ['expired', 'AccessTokenExpiredError'],
    ['scoped', 'ScopeForbiddenError'],
    ['wrong-key', 'AccessTokenInvalidError'],
  ] as const;

  it.each(rejectedTokens)('surfaces the %s token as its Upload API error code', async (kind, code) => {
    const credentials = await signedProject(kind);

    const { api } = await renderSolution(
      'regular',
      { authToken: credentials.authToken, store: false },
      { pubkey: credentials.publicKey },
    );
    api.addFileFromObject(IMAGE.PIXEL);
    api.uploadAll();

    await expect.poll(() => entry(api)?.status, { timeout: 20_000 }).toBe('failed');
    const [error] = entry(api).errors;

    // An `AuthError` is an `UploadError`, so it classifies as UPLOAD_ERROR
    // and the distinguishing detail is the code the API sent.
    expect(error).toMatchObject({ type: 'UPLOAD_ERROR', payload: { error: { code } } });
  });

  it('reports a token function that throws as AUTH_TOKEN_ERROR, without reaching the API', async () => {
    const credentials = await signedProject();

    const cause = new Error('token endpoint is down');
    const { ctxName, api } = await renderSolution('regular', { store: false }, { pubkey: credentials.publicKey });
    inCtx<Config>('uc-config', ctxName).authToken = () => {
      throw cause;
    };

    api.addFileFromObject(IMAGE.PIXEL);
    api.uploadAll();

    await expect.poll(() => entry(api)?.status, { timeout: 20_000 }).toBe('failed');
    const [error] = entry(api).errors;

    // Their endpoint, not ours: its own type, with the original on `cause`.
    assert(error.type === 'AUTH_TOKEN_ERROR', `expected AUTH_TOKEN_ERROR, got ${error.type}`);
    expect(error.payload?.error).toBeInstanceOf(AuthTokenResolverError);
    expect(error.payload?.error.cause).toBe(cause);
    expect(error.message).toBe(error.payload?.error.message);
  });
});
