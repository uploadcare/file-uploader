import type { FileFromOptions, UploadcareFile } from '@uploadcare/upload-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import type { Config, UploadCtxProvider } from '@/index';
import { delay } from '@/utils/delay';
import { IMAGE } from '~/tests/fixtures/files';
import { createInCtx, inCtx, renderSolution } from '~/tests/utils/render-solution';
import { getCtxName } from '~/tests/utils/test-renderer';
import '~/types/jsx';

/**
 * A large group of documented options does nothing but reach `@uploadcare/upload-client`. Their whole contract is
 * "this value arrives in the upload call", so this stubs `uploadFile` and asserts the options object it receives —
 * no network, and it pins the name mapping, which is where a silent break would hide.
 */

const uploadFile = vi.hoisted(() => vi.fn());

vi.mock('@uploadcare/upload-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@uploadcare/upload-client')>();
  return { ...actual, uploadFile };
});

const UPLOADED = {
  uuid: '00000000-0000-4000-8000-000000000000',
  originalFilename: 'pixel.jpg',
  size: 1,
  isImage: true,
  mimeType: 'image/jpeg',
  cdnUrl: 'https://ucarecdn.com/00000000-0000-4000-8000-000000000000/',
} as unknown as UploadcareFile;

beforeEach(() => {
  uploadFile.mockReset();
  uploadFile.mockResolvedValue(UPLOADED);
});

/**
 * Uploads one file and returns the options `uploadFile` was called with. Resets the spy first so a test can call it
 * more than once and still read its own upload.
 */
const optionsFor = async (configProps: Parameters<typeof renderSolution>[1]): Promise<FileFromOptions> => {
  uploadFile.mockClear();
  const { api } = await renderSolution('regular', configProps);
  api.addFileFromObject(IMAGE.PIXEL);
  api.uploadAll();

  await vi.waitFor(() => expect(uploadFile).toHaveBeenCalled());
  return uploadFile.mock.calls[0][1] as FileFromOptions;
};

describe('options handed to upload-client', () => {
  it('passes the defaults through', async () => {
    const options = await optionsFor({});

    expect(options).toMatchObject({
      publicKey: 'demopublickey',
      store: 'auto',
      baseURL: 'https://upload.uploadcare.com',
      retryThrottledRequestMaxTimes: 3,
      retryNetworkErrorMaxTimes: 3,
      checkForUrlDuplicates: false,
      saveUrlForRecurrentUploads: false,
    });
  });

  it('passes the upload endpoint', async () => {
    expect((await optionsFor({ baseUrl: 'https://upload.example.com' })).baseURL).toBe('https://upload.example.com');
  });

  // A pubkey resolution already in flight must not overwrite a cname the caller set meanwhile: `computeProperty`
  // drops an async result once the value it started from has changed.
  //
  // The elements are built by hand rather than through `renderSolution`, which sets primitives as attributes before
  // the element connects and settles a tick before returning. Both of those avoid the race, so reproducing it needs
  // the assignment to land in the same tick as connection.
  it('keeps a custom CDN cname assigned in the same tick as connection', async () => {
    uploadFile.mockClear();
    const ctxName = getCtxName();
    const uploader = createInCtx('uc-file-uploader-regular', ctxName);
    const provider = createInCtx<UploadCtxProvider>('uc-upload-ctx-provider', ctxName);
    const config = createInCtx<Config>('uc-config', ctxName, {
      pubkey: 'demopublickey',
      'test-mode': 'true',
      'quality-insights': 'false',
    });

    page.render(<div ctx-name={ctxName}></div>);
    inCtx<HTMLElement>('div', ctxName).append(uploader, config, provider);
    config.cdnCname = 'https://cdn.example.com';

    // Negative wait: the in-flight pubkey resolution that must not win has no completion signal.
    await delay(500);
    expect(config.cdnCname).toBe('https://cdn.example.com');

    const api = provider.getAPI();
    api.addFileFromObject(IMAGE.PIXEL);
    api.uploadAll();
    await vi.waitFor(() => expect(uploadFile).toHaveBeenCalled());

    expect((uploadFile.mock.calls[0][1] as FileFromOptions).baseCDN).toBe('https://cdn.example.com');
  });

  it('keeps a custom CDN cname set once the pubkey resolution has settled', async () => {
    uploadFile.mockClear();
    const { api, config } = await renderSolution('regular');

    // Wait for the pubkey-derived value to land first; with nothing in flight, an explicit cname then sticks.
    await expect.poll(() => config.cdnCname).toBe('https://1s4oyld5dc.ucarecd.net');
    config.cdnCname = 'https://cdn.example.com';

    api.addFileFromObject(IMAGE.PIXEL);
    api.uploadAll();
    await vi.waitFor(() => expect(uploadFile).toHaveBeenCalled());

    expect((uploadFile.mock.calls[0][1] as FileFromOptions).baseCDN).toBe('https://cdn.example.com');
  });

  it('passes store', async () => {
    expect((await optionsFor({ store: true })).store).toBe(true);
    expect((await optionsFor({ store: false })).store).toBe(false);
  });

  it('passes the retry limits', async () => {
    const options = await optionsFor({ retryThrottledRequestMaxTimes: 7, retryNetworkErrorMaxTimes: 9 });

    expect(options.retryThrottledRequestMaxTimes).toBe(7);
    expect(options.retryNetworkErrorMaxTimes).toBe(9);
  });

  it('passes the multipart tuning', async () => {
    const options = await optionsFor({
      multipartMinFileSize: 1024,
      multipartChunkSize: 2048,
      multipartMaxAttempts: 5,
      multipartMaxConcurrentRequests: 6,
    });

    expect(options.multipartMinFileSize).toBe(1024);
    expect(options.multipartChunkSize).toBe(2048);

    // upload-client dropped `multipartMaxAttempts` in 5.0.0 (chunk retries follow the retry options), so it is not sent.
    expect('multipartMaxAttempts' in options).toBe(false);
    // Deliberate rename: the uploader's `multipartMaxConcurrentRequests` (chunks in flight per file) is
    // upload-client's `maxConcurrentRequests`. The uploader's own `maxConcurrentRequests` is a different setting —
    // it caps whole files in flight and drives the internal upload queue, so it never reaches upload-client.
    expect(options.maxConcurrentRequests).toBe(6);
  });

  it('does not send the uploader-level concurrency cap to upload-client', async () => {
    const options = await optionsFor({ maxConcurrentRequests: 2, multipartMaxConcurrentRequests: 6 });

    expect(options.maxConcurrentRequests).toBe(6);
  });

  it('passes the url-upload flags', async () => {
    const options = await optionsFor({ checkForUrlDuplicates: true, saveUrlForRecurrentUploads: true });

    expect(options.checkForUrlDuplicates).toBe(true);
    expect(options.saveUrlForRecurrentUploads).toBe(true);
  });

  it('passes static secure-upload credentials', async () => {
    const options = await optionsFor({ secureSignature: 'sig', secureExpire: '9999999999' });

    expect(options.secureSignature).toBe('sig');
    expect(options.secureExpire).toBe('9999999999');
  });

  it('passes metadata and tags', async () => {
    const options = await optionsFor({ metadata: { plan: 'pro' }, tags: ['a', 'b'] });

    expect(options.metadata).toEqual({ plan: 'pro' });
    expect(options.tags).toEqual(['a', 'b']);
  });

  it('resolves metadata and tags from a function per file', async () => {
    const options = await optionsFor({
      metadata: (entry) => ({ name: entry.name ?? '' }),
      tags: () => ['resolved'],
    });

    expect(options.metadata).toEqual({ name: 'pixel.jpg' });
    expect(options.tags).toEqual(['resolved']);
  });

  it('passes a plain authToken straight through', async () => {
    // The SSR shape: the token is already minted, so there is nothing to cache.
    const options = await optionsFor({ authToken: 'eyJ.token.sig' });

    expect(options.authToken).toBe('eyJ.token.sig');
  });

  it('picks up an authToken attribute set after the element is connected', async () => {
    // The attribute form is the SSR shape, and it was silently ignored while
    // `authToken` sat in `complexConfigKeys`.
    uploadFile.mockClear();
    const { ctxName, api } = await renderSolution('regular', {});
    inCtx<Config>('uc-config', ctxName).setAttribute('auth-token', 'eyJ.token.sig');
    api.addFileFromObject(IMAGE.PIXEL);
    api.uploadAll();

    await vi.waitFor(() => expect(uploadFile).toHaveBeenCalled());
    expect((uploadFile.mock.calls[0][1] as FileFromOptions).authToken).toBe('eyJ.token.sig');
  });

  it('passes a cached provider for an authToken function, not the raw config value', async () => {
    // upload-client calls the resolver before every request, so handing it the
    // raw config function would re-fetch a token per request. It gets a
    // provider rather than a bare function, so it can also drop a token the
    // Upload API refuses and retry with a new one.
    const fetchToken = vi.fn(async () => 'resolved.token.sig');
    const options = await optionsFor({ authToken: fetchToken });

    expect(typeof options.authToken).toBe('object');
    expect(options.authToken).not.toBe(fetchToken);

    const provider = options.authToken as {
      getToken: () => Promise<string>;
      invalidate: () => void;
    };
    await expect(provider.getToken()).resolves.toBe('resolved.token.sig');
    await expect(provider.getToken()).resolves.toBe('resolved.token.sig');
    expect(fetchToken).toHaveBeenCalledTimes(1);

    provider.invalidate();
    await expect(provider.getToken()).resolves.toBe('resolved.token.sig');
    expect(fetchToken).toHaveBeenCalledTimes(2);
  });

  it('hands the same cached provider to getAuthToken() as to upload-client', async () => {
    // A plugin forwards `api.getAuthToken()` so it shares this cache instead of
    // calling the app's token endpoint again.
    const fetchToken = vi.fn(async () => 'resolved.token.sig');
    const { api } = await renderSolution('regular', { authToken: fetchToken });

    const { getToken } = api.getAuthToken() as { getToken: () => Promise<string> };
    await expect(getToken()).resolves.toBe('resolved.token.sig');
    await expect(getToken()).resolves.toBe('resolved.token.sig');
    expect(fetchToken).toHaveBeenCalledTimes(1);

    api.invalidateAuthToken();
    await expect(getToken()).resolves.toBe('resolved.token.sig');
    expect(fetchToken).toHaveBeenCalledTimes(2);
  });

  it('returns a plain string authToken from getAuthToken() unchanged', async () => {
    const { api } = await renderSolution('regular', { authToken: 'eyJ.token.sig' });
    expect(api.getAuthToken()).toBe('eyJ.token.sig');
  });

  it('drops the legacy signature params when authToken is set', async () => {
    const options = await optionsFor({
      authToken: 'eyJ.token.sig',
      secureSignature: 'sig',
      secureExpire: '9999999999',
    });

    expect(options.authToken).toBe('eyJ.token.sig');
    expect(options.secureSignature).toBeUndefined();
    expect(options.secureExpire).toBeUndefined();
  });
});
