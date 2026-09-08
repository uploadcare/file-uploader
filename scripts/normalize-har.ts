import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { bodyKey } from '../tests/utils/network-snapshot';

/**
 * Trims the e2e network recordings written by `E2E_NET=record` down to what replay actually uses, then drops whatever
 * response bodies that leaves unreferenced. Run by `npm run test:e2e:record` right after the recording pass.
 *
 * A raw Playwright recording is ~5000 entries of headers, timings and connection detail, most of it repeated and much
 * of it different on every run — unreviewable as a diff and an order of magnitude larger than it needs to be in the
 * repo. What survives is what `tests/utils/network-snapshot.ts` reads back: method and URL to match on, status,
 * headers and body to answer with.
 */

const snapshotDir = path.resolve(import.meta.dirname, '../tests/__network__');

type Header = { name: string; value: string };

type PostData = { text?: string; mimeType?: string; _file?: string };

type Entry = {
  request: { method: string; url: string; postData?: PostData } & Record<string, unknown>;
  response: { status: number; headers: Header[]; content?: { _file?: string } } & Record<string, unknown>;
} & Record<string, unknown>;

/** Change on every request, so keeping them would make each re-record a diff of nothing but timestamps. */
const VOLATILE = new Set(['date', 'age', 'expires', 'set-cookie', 'x-request-id', 'server-timing', 'alt-svc']);

/** Describes a body that is stored decoded and served through `route.fulfill`, so announcing either would corrupt it. */
const RECOMPUTED = new Set(['content-encoding', 'content-length']);

/**
 * Replaces an upload's body with the key replay matches it by. Keeping the bytes would mean committing every
 * uploaded fixture once per upload — they cannot be shared between entries the way response bodies are, because each
 * carries its own multipart boundary.
 */
const bodyKeyOf = (postData: PostData | undefined) => {
  if (!postData) {
    return undefined;
  }
  const body = postData._file
    ? readFileSync(path.join(snapshotDir, postData._file)).toString('latin1')
    : (postData.text ?? '');
  return bodyKey(body, postData.mimeType);
};

const trim = (entry: Entry): Entry => ({
  request: { method: entry.request.method, url: entry.request.url, _bodyKey: bodyKeyOf(entry.request.postData) },
  response: {
    status: entry.response.status,
    headers: entry.response.headers.filter(({ name }) => {
      const header = name.toLowerCase();
      return !VOLATILE.has(header) && !RECOMPUTED.has(header);
    }),
    content: entry.response.content,
  },
});

/**
 * Two entries collapse only when the response is the same as well, never on the request alone. Replay hands out a
 * repeated request's responses in the order they were recorded, so a poll that answered "progress" and then "success"
 * has to keep both — while the same thumbnail fetched thirty times is one entry, and that is where the size goes.
 */
const identity = (entry: Entry) =>
  [
    entry.request.method,
    entry.request.url,
    bodyKeyOf(entry.request.postData) ?? '',
    entry.response.status,
    entry.response.content?._file ?? '',
  ].join(' ');

const files = readdirSync(snapshotDir);
const referenced = new Set<string>();
let removed = 0;

for (const file of files.filter((name) => name.endsWith('.har'))) {
  const harPath = path.join(snapshotDir, file);
  const har = JSON.parse(readFileSync(harPath, 'utf8')) as { log: { entries: Entry[] } };
  const entries = har.log.entries;

  const seen = new Set<string>();
  const kept: Entry[] = [];
  for (const entry of entries) {
    // A recording marks a request that never got a response with status -1. Almost all of them are loads the page
    // itself cancelled — a thumbnail whose element was replaced before the bytes arrived — and keeping them makes
    // replay cancel a request the live page would have completed. Dropping them costs nothing for the deliberate
    // failures either: an unrecorded request aborts anyway, which is what those tests are watching for.
    if (entry.response.status <= 0) {
      continue;
    }
    const key = identity(entry);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    kept.push(trim(entry));
  }
  removed += entries.length - kept.length;

  har.log.entries = kept;
  writeFileSync(harPath, `${JSON.stringify(har, null, 2)}\n`);

  for (const entry of kept) {
    if (entry.response.content?._file) {
      referenced.add(entry.response.content._file);
    }
  }
}

// Bodies are content-addressed and shared between snapshots, so a dropped entry only strands one if nothing else
// pointed at it. Request bodies — every uploaded fixture — are always stranded: replay does not match on them.
const orphans = files.filter((name) => !name.endsWith('.har') && name !== 'README.md' && !referenced.has(name));
for (const orphan of orphans) {
  rmSync(path.join(snapshotDir, orphan));
}

console.log(`normalize-har: dropped ${removed} duplicate entries and ${orphans.length} unreferenced bodies`);
