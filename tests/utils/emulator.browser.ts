import { XMLHttpRequestInterceptor } from '@mswjs/interceptors/XMLHttpRequest';
// TEMPORARY: file: dependency, see package.json's "@uploadcare/api-emulator" — swap for a published version range
// once the package ships, and drop this comment.
import { handle, resetSession } from '@uploadcare/api-emulator';
import { http, passthrough } from 'msw';
import { setupWorker } from 'msw/browser';
import { delay } from '@/utils/delay';

/**
 * The fake Uploadcare, running in the page. Two ways in, one state:
 * - `XMLHttpRequestInterceptor` answers XHR (every upload) in-process, so `xhr.upload` progress fires per body
 *   chunk, as MSW's recipe describes (https://mswjs.io/docs/recipes/xmlhttprequest-progress-events/);
 * - the MSW Service Worker answers `fetch` and resource loads (`<img>`), which no in-page hook can reach.
 * `handle` returns `undefined` for anything that is not Uploadcare; only the page's own origin (the Vite server) may
 * pass through, everything else fails loudly, so a new or mistyped endpoint cannot slip out to the real service.
 *
 * `E2E_NET=live` leaves the page alone and lets the suite hit the real service; see `./network.ts`.
 */
/** The page-side flag; `./network.ts` is the Node side. */
export const isLive = import.meta.env.E2E_NET === 'live';

let started: Promise<void> | undefined;

/** `undefined` for a request the page may make, an error naming the URL for one that would leave it. */
const refuse = (url: string): TypeError | undefined => {
  if (new URL(url).origin === location.origin) {
    return;
  }
  const error = new TypeError(`E2E_NET=fake: ${url} is neither Uploadcare nor the Vite server`);
  console.error(error.message);
  return error;
};

const start = async () => {
  const xhr = new XMLHttpRequestInterceptor();
  xhr.on('request', async ({ request, controller }) => {
    const response = await handle(request);
    if (!response) {
      const error = refuse(request.url);
      if (error) {
        controller.errorWith(error);
      }
      return;
    }
    // One macrotask between `send()` and the first upload event. In-process the whole XHR would otherwise finish
    // within microtasks of `send()`, before the uploader's store flushes (`TypedCollection`, a `setTimeout(0)`), and
    // `file-upload-start`/`file-upload-progress` would never be observed. A real network cannot answer that fast.
    await delay(0);
    controller.respondWith(response);
  });
  xhr.apply();

  const worker = setupWorker(
    http.all('*', async ({ request }) => {
      const response = await handle(request);
      if (response) {
        return response;
      }
      return refuse(request.url) ? Response.error() : passthrough();
    }),
  );
  // The worker script is served by @vitest/browser at /mockServiceWorker.js (it maps the path to msw's own copy), so
  // there is no `msw init`. Vitest 4 mocks modules over RPC, not through MSW, so this is the only worker in the page.
  // `http.all('*')` handles every request, so `onUnhandledRequest` never fires and is left at its default.
  await worker.start({ quiet: true });
};

/** Starts both once per page (one per test file) and clears what the last test uploaded. Live runs touch nothing. */
export const useEmulator = async () => {
  if (isLive) {
    return;
  }
  started ??= start();
  await started;
  resetSession();
};
