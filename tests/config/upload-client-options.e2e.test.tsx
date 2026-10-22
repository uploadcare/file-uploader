import { DEMO_IMAGE_UUID, mintAuthToken } from '@uploadcare/api-emulator';
import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import type { Config, UploadCtxProvider } from '@/index';
import { withResolvers } from '@/utils/withResolvers';
import { IMAGE } from '~/tests/fixtures/files';
import { emulatorSession, isLive } from '~/tests/utils/emulator.browser';
import { createInCtx, inCtx, renderSolution } from '~/tests/utils/render-solution';
import { getCtxName } from '~/tests/utils/test-renderer';
import '~/types/jsx';

/**
 * A large group of documented options does nothing but reach `@uploadcare/upload-client`, so their contract is what
 * the upload does with them. Each is checked where it lands: what the emulator stored for an option the API keeps
 * (`store`), the URL the file was given (`cdnCname`), how many requests a retry limit allowed, and, for the rest, the
 * field or header the request carried, which is where a silently dropped option or a broken name mapping shows.
 * `multipartMaxAttempts` reaches nothing past `uploadFile`; `client-only-options.e2e` has it.
 *
 * Fake-only (`describe.skipIf(isLive)`): every check reads the emulator's session, and a live run has none.
 */

type Api = Awaited<ReturnType<typeof renderSolution>>['api'];

const entry = (api: Api) => api.getOutputCollectionState().allEntries[0];

/** Waits for the one entry to finish, either way, and answers how. */
const finished = async (api: Api) => {
  await expect.poll(() => entry(api)?.status, { timeout: 20_000 }).toMatch(/^(success|failed)$/);
  return entry(api).status;
};

/** Uploads `file` with `configProps` and answers how the upload ended. */
const upload = async (configProps: Partial<Config>, file: File = IMAGE.PIXEL) => {
  const { api } = await renderSolution('regular', configProps);
  api.addFileFromObject(file);
  api.uploadAll();
  return { api, status: await finished(api) };
};

/** The requests the emulator received for `method` on `path`, in order. */
const received = (method: string, path: string) =>
  emulatorSession().requests.filter((request) => request.method === method && new URL(request.url).pathname === path);

/** The form fields of the first single-file upload. */
const baseFields = () => received('POST', '/base/')[0].formData();

describe.skipIf(isLive)('options upload-client acts on', () => {
  it('passes the defaults through', async () => {
    const { status } = await upload({});

    expect(status).toBe('success');
    const [request] = received('POST', '/base/');
    expect(new URL(request.url).host).toBe('upload.uploadcare.com');
    const fields = await request.formData();
    expect(fields.get('UPLOADCARE_PUB_KEY')).toBe('demopublickey');
    expect(fields.get('UPLOADCARE_STORE')).toBe('auto');
  });

  it('passes the upload endpoint', async () => {
    await upload({ baseUrl: 'https://upload.example.com' });

    expect(received('POST', '/base/').map((request) => new URL(request.url).host)).toEqual(['upload.example.com']);
  });

  // QUIRK(config): the `cdnCname` computed property decides whether to override the current value *before* awaiting
  // `getPrefixedCdnBaseAsync` (Config/computed-properties.ts:74). A resolution already in flight from the pubkey
  // therefore lands with a guard evaluated against the old, default cname, and overwrites an explicit `cdnCname` set
  // in the meantime — so a documented option is silently dropped depending on timing. Pinned, not endorsed.
  //
  // The elements are built by hand rather than through `renderSolution`, which sets primitives as attributes before
  // the element connects and settles a tick before returning. Both of those avoid the race, so reproducing it needs
  // the assignment to land in the same tick as connection.
  it('loses a custom CDN cname assigned in the same tick as connection', async () => {
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

    await expect.poll(() => config.cdnCname).toBe('https://1s4oyld5dc.ucarecd.net');

    const api = provider.getAPI();
    api.addFileFromObject(IMAGE.PIXEL);
    api.uploadAll();

    expect(await finished(api)).toBe('success');
    expect(entry(api).cdnUrl).toBe(`https://1s4oyld5dc.ucarecd.net/${entry(api).uuid}/`);
  });

  it('keeps a custom CDN cname set once the pubkey resolution has settled', async () => {
    const { api, config } = await renderSolution('regular');

    // Wait for the pubkey-derived value to land first; with nothing in flight, an explicit cname then sticks.
    await expect.poll(() => config.cdnCname).toBe('https://1s4oyld5dc.ucarecd.net');
    config.cdnCname = 'https://cdn.example.com';

    api.addFileFromObject(IMAGE.PIXEL);
    api.uploadAll();

    expect(await finished(api)).toBe('success');
    expect(entry(api).cdnUrl).toBe(`https://cdn.example.com/${entry(api).uuid}/`);
  });

  it.each([true, false])('stores the file or not as store: %s says', async (store) => {
    const { api, status } = await upload({ store });

    expect(status).toBe('success');
    expect(emulatorSession().files.get(entry(api).uuid ?? '')?.isStored).toBe(store);
  });

  it('retries a throttled upload as many times as retryThrottledRequestMaxTimes allows', async () => {
    emulatorSession().use('throttle', { match: 'POST /base/', times: 100, retryAfter: 0 });

    const { status } = await upload({ retryThrottledRequestMaxTimes: 7 });

    expect(status).toBe('failed');
    // The first attempt and 7 retries.
    expect(received('POST', '/base/')).toHaveLength(8);
  });

  it('retries a throttled upload 3 times by default', async () => {
    emulatorSession().use('throttle', { match: 'POST /base/', times: 100, retryAfter: 0 });

    await upload({});

    expect(received('POST', '/base/')).toHaveLength(4);
  });

  it('retries a dropped connection as many times as retryNetworkErrorMaxTimes allows', async () => {
    // Retries wait a second longer each time, so 2: unlike the default of 3, and quick.
    emulatorSession().on('POST /base/', () => Response.error());

    const { status } = await upload({ retryNetworkErrorMaxTimes: 2 });

    expect(status).toBe('failed');
    expect(received('POST', '/base/')).toHaveLength(3);
  });

  it('retries a dropped connection 3 times by default', async () => {
    emulatorSession().on('POST /base/', () => Response.error());

    await upload({});

    expect(received('POST', '/base/')).toHaveLength(4);
  });

  it('passes the multipart size settings', async () => {
    // The 1.9 KB square is over the 1 KB threshold, so it goes multipart, in parts of the size asked for. The API
    // then refuses a multipart upload under 10 MB, which is beside the point: the start request is the subject.
    await upload({ multipartMinFileSize: 1024, multipartChunkSize: 2048 }, IMAGE.SQUARE);

    expect(received('POST', '/base/')).toHaveLength(0);
    const [start] = received('POST', '/multipart/start/');
    expect((await start.formData()).get('part_size')).toBe('2048');
  });

  describe('part concurrency', () => {
    /**
     * Three parts at the 5 MiB part size: two full ones, then a single byte. Over the API's 10 MB multipart minimum.
     */
    const threeParts = () => new File([new Uint8Array(2 * 5 * 1024 * 1024 + 1)], 'three-parts.bin');

    /** Holds every part PUT at the emulator until `release()`, and lists the part numbers in arrival order. */
    const holdParts = () => {
      const arrived: number[] = [];
      const released = withResolvers();
      emulatorSession().on('PUT /multipart/upload/:uuid/original', async ({ request, next }) => {
        arrived.push(Number(new URL(request.url).searchParams.get('partNumber')));
        await released.promise;
        return next();
      });
      return { arrived, release: () => released.resolve() };
    };

    it('sends one part at a time when multipartMaxConcurrentRequests is 1', async () => {
      // Deliberate rename: the uploader's `multipartMaxConcurrentRequests` (parts in flight per file) is
      // upload-client's `maxConcurrentRequests`.
      const parts = holdParts();
      const { api } = await renderSolution('regular', { multipartMinFileSize: 1, multipartMaxConcurrentRequests: 1 });
      api.addFileFromObject(threeParts());
      api.uploadAll();

      // Sent alongside, the one-byte third part would have arrived before the 5 MiB first one.
      await expect.poll(() => parts.arrived).toContain(1);
      expect(parts.arrived).toEqual([1]);

      parts.release();
      expect(await finished(api)).toBe('success');
      expect(parts.arrived).toEqual([1, 2, 3]);
    });

    it('does not apply the uploader-level concurrency cap to the parts', async () => {
      // The uploader's own `maxConcurrentRequests` caps whole files in flight and drives the internal upload queue;
      // it never reaches upload-client. The parts are held, so the first two only both arrive if they were sent at once.
      const parts = holdParts();
      const { api } = await renderSolution('regular', {
        multipartMinFileSize: 1,
        maxConcurrentRequests: 1,
        multipartMaxConcurrentRequests: 2,
      });
      api.addFileFromObject(threeParts());
      api.uploadAll();

      await expect.poll(() => [...parts.arrived].sort()).toEqual([1, 2]);
      parts.release();
      expect(await finished(api)).toBe('success');
    });
  });

  it('passes the url-upload flags', async () => {
    const { api } = await renderSolution('regular', { checkForUrlDuplicates: true, saveUrlForRecurrentUploads: true });
    api.addFileFromUrl(`https://ucarecdn.com/${DEMO_IMAGE_UUID}/`);
    api.uploadAll();
    await finished(api);

    const query = new URL(received('POST', '/from_url/')[0].url).searchParams;
    expect(query.get('check_URL_duplicates')).toBe('1');
    expect(query.get('save_URL_duplicates')).toBe('1');
  });

  it('leaves the url-upload flags off by default', async () => {
    const { api } = await renderSolution('regular');
    api.addFileFromUrl(`https://ucarecdn.com/${DEMO_IMAGE_UUID}/`);
    api.uploadAll();
    await finished(api);

    const query = new URL(received('POST', '/from_url/')[0].url).searchParams;
    expect(query.has('check_URL_duplicates')).toBe(false);
    expect(query.has('save_URL_duplicates')).toBe(false);
  });

  it('passes static secure-upload credentials', async () => {
    await upload({ secureSignature: 'sig', secureExpire: '9999999999' });

    const fields = await baseFields();
    expect(fields.get('signature')).toBe('sig');
    expect(fields.get('expire')).toBe('9999999999');
  });

  it('passes metadata and tags', async () => {
    await upload({ metadata: { plan: 'pro' }, tags: ['a', 'b'] });

    const fields = await baseFields();
    expect(fields.get('metadata[plan]')).toBe('pro');
    expect(fields.get('tags')).toBe('a,b');
  });

  it('resolves metadata and tags from a function per file', async () => {
    await upload({
      metadata: (outputEntry) => ({ name: outputEntry.name ?? '' }),
      tags: () => ['resolved'],
    });

    const fields = await baseFields();
    expect(fields.get('metadata[name]')).toBe('pixel.jpg');
    expect(fields.get('tags')).toBe('resolved');
  });

  it('sends a plain authToken as the bearer token', async () => {
    // The SSR shape: the token is already minted, so there is nothing to cache. The emulator refuses this made-up
    // token, which does not matter here: the header is the subject.
    await upload({ authToken: 'eyJ.token.sig' });

    expect(received('POST', '/base/')[0].headers.get('authorization')).toBe('Bearer eyJ.token.sig');
  });

  it('picks up an authToken attribute set after the element is connected', async () => {
    // The attribute form is the SSR shape, and it was silently ignored while
    // `authToken` sat in `complexConfigKeys`.
    const { ctxName, api } = await renderSolution('regular', {});
    inCtx<Config>('uc-config', ctxName).setAttribute('auth-token', 'eyJ.token.sig');
    api.addFileFromObject(IMAGE.PIXEL);
    api.uploadAll();
    await finished(api);

    expect(received('POST', '/base/')[0].headers.get('authorization')).toBe('Bearer eyJ.token.sig');
  });

  it('replaces a token the API refused, asking the authToken function once more', async () => {
    // upload-client tells the uploader's token cache to drop a token the Upload API refused, then asks again. The
    // first token is good for one request: the upload, and not the /info/ poll after it. That the cache asks only once
    // when nothing is refused is auth-token.e2e's "uploads with a token function, asking it once for the whole upload".
    emulatorSession().use('signedUploads');
    const fetchToken = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce(await mintAuthToken({ tokenId: 'one-operation', operations: 1 }))
      .mockResolvedValue(await mintAuthToken({ tokenId: 'unlimited' }));

    const { status } = await upload({ authToken: fetchToken, store: false });

    expect(status).toBe('success');
    expect(fetchToken).toHaveBeenCalledTimes(2);
  });

  it('drops the legacy signature params when authToken is set', async () => {
    // Both the uploader and upload-client drop them, so the request is where to look.
    await upload({ authToken: 'eyJ.token.sig', secureSignature: 'sig', secureExpire: '9999999999' });

    const [request] = received('POST', '/base/');
    expect(request.headers.get('authorization')).toBe('Bearer eyJ.token.sig');
    const fields = await request.formData();
    expect(fields.has('signature')).toBe(false);
    expect(fields.has('expire')).toBe(false);
  });
});

describe('getAuthToken()', () => {
  it('hands out the cached provider for an authToken function', async () => {
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

  it('returns a plain string authToken unchanged', async () => {
    const { api } = await renderSolution('regular', { authToken: 'eyJ.token.sig' });
    expect(api.getAuthToken()).toBe('eyJ.token.sig');
  });
});
