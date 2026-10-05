import { AuthTokenResolverError } from '@uploadcare/upload-client';
import { describe, expect, it, vi } from 'vitest';
import { commands } from 'vitest/browser';
import type { Config } from '@/index';
import { IMAGE } from '~/tests/fixtures/files';
import { inCtx, renderSolution } from '~/tests/utils/render-solution';
import '~/types/jsx';

/**
 * `authToken` as a credential rather than as an option: the two questions that
 * only matter because it is a bearer token.
 *
 * Where it must not appear — the DOM, the console — and whether Upload API
 * actually accepts what the uploader sends, which no stub can answer.
 * `upload-client-options.e2e` covers the value reaching the upload call, and
 * `upload-errors.e2e` how a failure is classified.
 *
 * The real uploads need a project with Signed Uploads enabled, which rejects
 * every unsigned request. Tokens are minted by a Node-side command, since the
 * project secret key must never reach the page, and the tests skip where its
 * credentials are absent.
 */

const TOKEN = 'eyJ.a-real-looking-token.sig';

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

  it('stays out of the debug log', async (ctx) => {
    const credentials = await commands.mintSecureUploadsCredentials();
    if (!credentials) return ctx.skip();

    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
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
    } finally {
      log.mockRestore();
    }
  });
});

describe('authToken against the real Upload API', () => {
  it('uploads a file the project would otherwise refuse', async (ctx) => {
    const credentials = await commands.mintSecureUploadsCredentials();
    if (!credentials) return ctx.skip();

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

  it('fails the upload when the same project gets no token', async (ctx) => {
    // Without this the rest proves nothing: a project that does not enforce
    // signed uploads would accept every upload below, token or not.
    const credentials = await commands.mintSecureUploadsCredentials();
    if (!credentials) return ctx.skip();

    const { api } = await renderSolution('regular', { store: false }, { pubkey: credentials.publicKey });
    api.addFileFromObject(IMAGE.PIXEL);
    api.uploadAll();

    await expect.poll(() => entry(api)?.status, { timeout: 20_000 }).toBe('failed');
    const [error] = entry(api).errors;

    expect(error.type).toBe('UPLOAD_ERROR');
    expect(error.type === 'UPLOAD_ERROR' ? error.payload?.error.code : undefined).toBe('SignatureRequiredError');
  });

  it('uploads with a token function, asking it once for the whole upload', async (ctx) => {
    const credentials = await commands.mintSecureUploadsCredentials();
    if (!credentials) return ctx.skip();

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

  const rejectedTokens = [
    ['expired', 'AccessTokenExpiredError'],
    ['scoped', 'ScopeForbiddenError'],
    ['wrong-key', 'AccessTokenInvalidError'],
  ] as const;

  for (const [kind, code] of rejectedTokens) {
    it(`surfaces the ${kind} token as its Upload API error code`, async (ctx) => {
      const credentials = await commands.mintSecureUploadsCredentials(kind);
      if (!credentials) return ctx.skip();

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
      expect(error.type).toBe('UPLOAD_ERROR');
      expect(error.type === 'UPLOAD_ERROR' ? error.payload?.error.code : undefined).toBe(code);
    });
  }

  it('reports a token function that throws as AUTH_TOKEN_ERROR, without reaching the API', async (ctx) => {
    const credentials = await commands.mintSecureUploadsCredentials();
    if (!credentials) return ctx.skip();

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
    expect(error.type).toBe('AUTH_TOKEN_ERROR');
    const reported = error.type === 'AUTH_TOKEN_ERROR' ? error.payload?.error : undefined;
    expect(reported).toBeInstanceOf(AuthTokenResolverError);
    expect(reported?.cause).toBe(cause);
  });
});
