import type { FileFromOptions, UploadcareFile } from '@uploadcare/upload-client';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { IMAGE } from './fixtures/files';
import { renderSolution } from './utils/render-solution';
import '../types/jsx';

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

beforeAll(async () => {
  const UC = await import('@/index.js');
  UC.defineComponents(UC);
});

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

  // QUIRK(config): the `cdnCname` computed property decides whether to override the current value *before* awaiting
  // `getPrefixedCdnBaseAsync` (Config/computed-properties.ts:74). A resolution already in flight from the pubkey
  // therefore lands with a guard evaluated against the old, default cname, and overwrites an explicit `cdnCname` set
  // in the meantime — so a documented option is silently dropped depending on timing. Pinned, not endorsed.
  it('loses a custom CDN cname set after the pubkey resolution has started', async () => {
    uploadFile.mockClear();
    const { api, config } = await renderSolution('regular', { cdnCname: 'https://cdn.example.com' });

    await expect.poll(() => config.cdnCname).toBe('https://1s4oyld5dc.ucarecd.net');

    api.addFileFromObject(IMAGE.PIXEL);
    api.uploadAll();
    await vi.waitFor(() => expect(uploadFile).toHaveBeenCalled());

    expect((uploadFile.mock.calls[0][1] as FileFromOptions).baseCDN).toBe('https://1s4oyld5dc.ucarecd.net');
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

    // QUIRK(config): `multipartMaxAttempts` is documented as "the maximum number of retry attempts for failed
    // multipart upload chunks" and is forwarded to `uploadFile` (LitUploaderBlock.ts:440), but the option does not
    // exist in @uploadcare/upload-client — the string appears nowhere in the package, and `FileFromOptions` has no
    // such field. It arrives and is ignored, so setting it has no effect at all. The cast is deliberate: the option
    // is genuinely not part of the upload-client type. Pinned as current behaviour, not endorsed.
    expect((options as { multipartMaxAttempts?: unknown }).multipartMaxAttempts).toBe(5);
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
});
