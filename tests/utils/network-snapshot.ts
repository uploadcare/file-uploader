import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Page } from 'playwright';
import type { BrowserCommand } from 'vitest/node';

/**
 * How the e2e suite talks to the network. `replay` (the default) serves every request from the test file's committed
 * snapshot, so a run needs neither API access nor luck with timing; `record` refreshes those snapshots against the
 * real API; `live` bypasses them entirely, which is what release branches run to catch API drift.
 */
export type NetworkMode = 'replay' | 'record' | 'live';

export const networkMode = (process.env.E2E_NET ?? 'replay') as NetworkMode;

const snapshotDir = path.resolve(import.meta.dirname, '../__network__');
const testsDir = path.resolve(snapshotDir, '..');

/** `tests/plugins/lifecycle.e2e.test.tsx` -> `tests/__network__/plugins__lifecycle.har`, so the tree stays flat. */
const harPathFor = (testPath: string) => {
  const name = path
    .relative(testsDir, testPath)
    .replace(/\.e2e\.test\.tsx?$/, '')
    .replaceAll(path.sep, '__');
  return path.join(snapshotDir, `${name}.har`);
};

const TELEMETRY_URL = 'https://tlm.uploadcare.com/api/v1/events';

/**
 * Everything third-party, minus telemetry. The app's own modules must keep coming from the running Vite server —
 * snapshotting them would pin the code under test to whatever was on disk at record time — so localhost is excluded,
 * and requiring an http(s) scheme leaves `blob:`/`data:` URLs alone as well: a blob URL is minted fresh every run, so
 * a recorded one could never match, and the preview it backs would break.
 *
 * Telemetry is excluded because it is fire-and-forget and by far the loudest thing on the wire — recording it made up
 * 86% of the snapshot's entries — while nothing asserts on it from the network (`telemetry.e2e.test.tsx` stubs
 * `window.fetch` itself). It gets a canned 200 below instead.
 *
 * Nothing else is filtered on purpose: an allowlist of known hosts would let a newly added endpoint slip through to
 * the real network unnoticed, which is exactly what the snapshot exists to prevent.
 */
const snapshotted = /^https?:\/\/(?!localhost[:/]|127\.0\.0\.1[:/]|tlm\.uploadcare\.com\/)/;

/**
 * Identifies an upload among the other requests to the same URL, by the form fields around the file rather than the
 * file itself.
 *
 * Every upload POSTs to `/base/`, so without this a local upload can draw the response recorded for a JS-API one, and
 * the `/info/` call that follows then asks about a UUID nothing recorded — `source` is a form field, and it is what
 * decides whether that call is recorded as `source=local`, `source=js-api` or `source=camera`.
 *
 * The file part is deliberately excluded along with the boundary, because neither survives a re-run: the boundary is
 * regenerated per request, and a camera capture is different bytes under a different name every time. Two uploads that
 * differ only in their file therefore share a queue and are answered in the order they were recorded, which is what
 * replay does for every other repeated request anyway.
 *
 * Anything that is not a multipart form gets no key at all and matches on its URL alone. Creating a group posts the
 * UUIDs the recorded uploads just handed back, so hashing that body could only ever miss.
 */
export const bodyKey = (body: Buffer | string, contentType?: string) => {
  const boundary = contentType?.match(/boundary=(\S+)/)?.[1];
  if (!boundary) {
    return undefined;
  }
  const fields = (typeof body === 'string' ? body : body.toString('latin1'))
    .split(`--${boundary}`)
    .filter((part) => part.includes('Content-Disposition') && !part.includes('filename='));
  return createHash('sha1').update(fields.join('')).digest('hex');
};

type Entry = {
  request: { method: string; url: string; _bodyKey?: string };
  response: {
    status: number;
    headers?: { name: string; value: string }[];
    content?: { text?: string; encoding?: string; _file?: string };
  };
};

/**
 * Replays a recording, handing out the responses to a repeated request in the order they were recorded.
 *
 * Playwright's own `routeFromHAR` cannot do this — it matches on method + URL + body and never consumes an entry, so
 * it answers every repeat with the same response. That breaks the two things this suite does constantly: polling
 * `/from_url/status/` never advances past "progress", and uploading the same fixture twice hands back one UUID twice,
 * which then fails to match the group the recording created from two distinct ones.
 *
 * Once a request has been made more often than it was recorded the last response repeats, so a test that renders one
 * more thumbnail than the recording saw still gets an image rather than a dead request. A request that was never
 * recorded aborts instead of reaching the network: a test that starts calling something new fails loudly, rather than
 * passing only on a machine with API access.
 */
const CDN_UUID = /^\/([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})\//;

/**
 * A rendition of one CDN file, ignoring what was asked of it. The operations in a CDN URL encode the size the element
 * was rendered at — `-/crop/263x264/160,0/`, `-/resize/612x/` — and that is decided by layout, which lands slightly
 * differently on a run where every response is instant. The editor and `<uc-img>` would then ask for a URL nothing
 * recorded, so as a last resort any recorded rendition of the same file answers: these tests assert on the DOM built
 * around the image, never on its pixels.
 *
 * Only images, in both directions. `-/json/` on the same file returns the metadata the editor works from, and neither
 * side of that swap is survivable: an image decoded as metadata, or metadata handed to an `<img>`.
 */
const imageKey = (url: string) => {
  const { origin, pathname } = new URL(url);
  const uuid = pathname.match(CDN_UUID)?.[1];
  return uuid ? `image ${origin}/${uuid}` : undefined;
};

const contentTypeOf = (entry: Entry) =>
  entry.response.headers?.find(({ name }) => name.toLowerCase() === 'content-type')?.value ?? '';

const replayFrom = async (page: Page, harPath: string) => {
  const har = JSON.parse(await readFile(harPath, 'utf8')) as { log: { entries: Entry[] } };
  const bodyDir = path.dirname(harPath);

  const keyOf = (method: string, url: string, body?: string) => `${method} ${url}${body ? ` ${body}` : ''}`;

  const recorded = new Map<string, Entry[]>();
  const add = (key: string, entry: Entry) => {
    const existing = recorded.get(key);
    if (existing) {
      existing.push(entry);
    } else {
      recorded.set(key, [entry]);
    }
  };
  for (const entry of har.log.entries) {
    const { method, url, _bodyKey } = entry.request;
    add(keyOf(method, url, _bodyKey), entry);
    if (_bodyKey) {
      add(keyOf(method, url), entry);
    }
    const image = method === 'GET' && contentTypeOf(entry).startsWith('image/') ? imageKey(url) : undefined;
    if (image) {
      add(image, entry);
    }
  }

  const served = new Map<string, number>();

  await page.route(snapshotted, async (route) => {
    const request = route.request();
    const method = request.method();
    const url = request.url();
    const body = request.postDataBuffer();

    // Three tiers, narrowest first. The URL alone covers bodies that cannot survive a replay because they are built
    // out of one — creating a group posts the UUIDs the recorded uploads just handed back, so its body never hashes
    // to what was recorded — while uploads keep matching on their fields, which is the case that needs the precision.
    const candidates = [
      keyOf(method, url, body ? bodyKey(body, request.headers()['content-type']) : undefined),
      keyOf(method, url),
      request.resourceType() === 'image' ? imageKey(url) : undefined,
    ];
    const key = candidates.find((candidate) => candidate && recorded.has(candidate));
    if (!key) {
      if (process.env.E2E_NET_DEBUG) {
        console.log('[MISS]', `${method} ${url}`.slice(0, 140));
      }
      await route.abort();
      return;
    }

    const entries = recorded.get(key) as Entry[];
    const index = served.get(key) ?? 0;
    served.set(key, index + 1);
    const { response } = entries[Math.min(index, entries.length - 1)];

    // A recording keeps requests that never got a response as status -1: an image load the page cancelled, or a host
    // a test points at deliberately to watch the failure. Failing them again is the faithful replay; fulfilling one
    // is not even possible.
    if (response.status <= 0) {
      await route.abort();
      return;
    }

    const { content } = response;
    await route.fulfill({
      status: response.status,
      headers: Object.fromEntries((response.headers ?? []).map(({ name, value }) => [name, value])),
      body: content?._file
        ? await readFile(path.join(bodyDir, content._file))
        : Buffer.from(content?.text ?? '', content?.encoding === 'base64' ? 'base64' : 'utf8'),
    });
  });
};

/** Installs the test file's network snapshot. Called once per file from the e2e setup file, before anything renders. */
export const useNetworkSnapshot: BrowserCommand<[]> = async ({ page, testPath }) => {
  if (networkMode === 'live') {
    return;
  }
  if (!testPath) {
    throw new Error('Test path is not defined');
  }

  if (networkMode === 'record') {
    // Recording is the one thing Playwright does well here. Bodies are attached as sibling files, content-addressed,
    // so the fixtures shared between test files are stored once.
    await page.routeFromHAR(harPathFor(testPath), { url: snapshotted, update: true, updateContent: 'attach' });
  } else {
    await replayFrom(page, harPathFor(testPath));
  }

  await page.route(TELEMETRY_URL, (route) => route.fulfill({ status: 200, body: '{}' }));
};
