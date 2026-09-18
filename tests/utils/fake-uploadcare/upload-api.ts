import { HttpResponse, http } from 'msw';
import { fileInfo, nextUuid, STOCK_IMAGE, sessionOf, store } from './files';
import { imageSize } from './image-size';

/**
 * https://upload.uploadcare.com — the endpoints the uploader actually calls, answering from what has been uploaded to
 * this fake in this test rather than from a recording.
 */

const UPLOAD = 'https://upload.uploadcare.com';

/** `store=auto` leaves it to project settings, and the demo project stores. */
const storedBy = (value: string | null) => value !== '0' && value !== 'false';

const notFound = (content: string) => HttpResponse.json({ error: { status_code: 404, content } }, { status: 404 });

/** The name the real API takes from a download URL: the `dl` parameter when there is one, the last segment if not. */
const nameFromUrl = (sourceUrl: string) => {
  const url = new URL(sourceUrl);
  return url.searchParams.get('dl') ?? url.pathname.split('/').filter(Boolean).at(-1) ?? 'file';
};

/**
 * The hosts a `from_url` upload can be fetched from. Nothing is ever really fetched, so the fake cannot discover that
 * a host does not resolve the way the service would — it has to be told.
 *
 * Add a host here when a test starts uploading from one. Everything else fails the way the real API fails a host that
 * does not exist, which is what `fake-domain-that-will-404.com` is for in the validation tests.
 */
const REACHABLE_HOSTS = ['images.unsplash.com', 'ucarecdn.com'];

export const uploadApi = [
  /** Direct upload. The file part is kept whole, because the CDN has to serve it back. */
  http.post(`${UPLOAD}/base/`, async ({ request }) => {
    const form = await request.formData();
    const part = form.get('file');
    if (!(part instanceof File)) {
      return HttpResponse.json({ error: { status_code: 400, content: 'file is required' } }, { status: 400 });
    }

    const bytes = new Uint8Array(await part.arrayBuffer());
    const stored = store(sessionOf(request), {
      name: part.name,
      size: bytes.byteLength,
      mimeType: part.type || 'application/octet-stream',
      bytes,
      image: imageSize(bytes),
      isStored: storedBy(form.get('UPLOADCARE_STORE') as string | null),
    });

    return HttpResponse.json({ file: stored.uuid });
  }),

  http.get(`${UPLOAD}/info/`, ({ request }) => {
    const id = new URL(request.url).searchParams.get('file_id') ?? '';
    const file = sessionOf(request).files.get(id);
    return file ? HttpResponse.json(fileInfo(file)) : notFound('file_id is invalid');
  }),

  /**
   * Upload from a URL. Nothing is fetched: the job resolves to a stock image under the name the URL implies, which is
   * what the tests assert on. A test that needs the bytes behind a real URL wants `E2E_NET=live`.
   *
   * A URL whose host is not reachable still gets a token — the real API only reports the failure once the job is
   * polled, and the uploader's error handling depends on that.
   */
  http.post(`${UPLOAD}/from_url/`, ({ request }) => {
    const session = sessionOf(request);
    const params = new URL(request.url).searchParams;
    const sourceUrl = params.get('source_url') ?? '';
    const token = nextUuid(session);
    const host = URL.parse(sourceUrl)?.host;

    const uuid =
      host && REACHABLE_HOSTS.includes(host)
        ? store(session, {
            name: nameFromUrl(sourceUrl),
            size: STOCK_IMAGE.byteLength,
            mimeType: 'image/jpeg',
            bytes: STOCK_IMAGE,
            image: imageSize(STOCK_IMAGE),
            isStored: storedBy(params.get('store')),
          }).uuid
        : '';

    session.fromUrlJobs.set(token, { uuid, polls: 0 });
    return HttpResponse.json({ type: 'token', token });
  }),

  /**
   * The poll behind it, which reports progress once before it finishes. Answering straight away would let the suite
   * pass without ever rendering the in-progress state the real API always goes through.
   */
  http.get(`${UPLOAD}/from_url/status/`, ({ request }) => {
    const session = sessionOf(request);
    const token = new URL(request.url).searchParams.get('token') ?? '';
    const job = session.fromUrlJobs.get(token);
    if (!job) {
      return notFound('token is invalid');
    }

    const file = session.files.get(job.uuid);
    job.polls += 1;
    if (!file) {
      return HttpResponse.json({ status: 'error', error: 'Host does not exist' });
    }
    if (job.polls === 1) {
      return HttpResponse.json({ status: 'progress', done: 0, total: file.size });
    }
    return HttpResponse.json({ status: 'success', ...fileInfo(file) });
  }),

  /** Creating a group out of files this fake already holds. */
  http.post(`${UPLOAD}/group/`, async ({ request }) => {
    const session = sessionOf(request);
    const form = await request.formData().catch(() => new FormData());
    const params = new URL(request.url).searchParams;
    const members = [...form.entries(), ...params.entries()]
      .filter(([name]) => /^files\[\d+]$/.test(name))
      .map(([, value]) => String(value).split('~')[0]);

    const files = members.map((uuid) => session.files.get(uuid));
    const missingAt = files.findIndex((file) => !file);
    if (missingAt >= 0) {
      return HttpResponse.json(
        { error: { status_code: 400, content: `file ${members[missingAt]} is not found` } },
        { status: 400 },
      );
    }

    const id = `${nextUuid(session)}~${members.length}`;
    session.groups.set(id, members);
    return HttpResponse.json({
      id,
      datetime_created: new Date(0).toISOString(),
      datetime_stored: null,
      files_count: members.length,
      cdn_url: `https://ucarecdn.com/${id}/`,
      url: `https://api.uploadcare.com/groups/${id}/`,
      files: files.map((file) => ({ ...fileInfo(file as NonNullable<typeof file>), default_effects: '' })),
    });
  }),
];
