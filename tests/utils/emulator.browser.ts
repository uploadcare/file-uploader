import { XMLHttpRequestInterceptor } from '@mswjs/interceptors/XMLHttpRequest';
// TEMPORARY: file: dependency, see package.json's "@uploadcare/api-emulator" — swap for a published version range
// once the package ships, and drop this comment.
import { handle, resetSession } from '@uploadcare/api-emulator';
import { http, passthrough } from 'msw';
import { setupWorker } from 'msw/browser';

/**
 * The fake Uploadcare, running in the page. Two ways in, one state:
 * - `XMLHttpRequestInterceptor` answers XHR (every upload) in-process, so `xhr.upload` progress fires per body
 *   chunk, as MSW's recipe describes (https://mswjs.io/docs/recipes/xmlhttprequest-progress-events/);
 * - the MSW Service Worker answers `fetch` and resource loads (`<img>`), which no in-page hook can reach.
 * `handle` returns `undefined` for anything that is not Uploadcare, and that goes through to the real network.
 *
 * `E2E_NET=live` leaves the page alone and lets the suite hit the real service; see `./network.ts`.
 */
const isLive = import.meta.env.E2E_NET === 'live';

let started: Promise<void> | undefined;

const nextTask = () => new Promise<void>((resolve) => setTimeout(resolve));

/**
 * Holds the response body back by one macrotask. In-page, the whole XHR — upload progress, response, `load` — would
 * otherwise complete within microtasks of `send()`, before the uploader's store flushes (`TypedCollection`, a
 * `setTimeout(0)`), and `file-upload-start`/`file-upload-progress` would never be observed: by the time the store
 * looks, the file is already done. A real network cannot answer before the body has gone out; this keeps that order.
 */
const afterUpload = (response: Response): Response => {
  if (!response.body) {
    return response;
  }
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const bytes = new Uint8Array(await response.arrayBuffer());
      await nextTask();
      controller.enqueue(bytes);
      controller.close();
    },
  });
  return new Response(body, response);
};

const start = async () => {
  const xhr = new XMLHttpRequestInterceptor();
  xhr.on('request', async ({ request, controller }) => {
    const response = await handle(request);
    if (response) {
      controller.respondWith(afterUpload(response));
    }
  });
  xhr.apply();

  const worker = setupWorker(http.all('*', async ({ request }) => (await handle(request)) ?? passthrough()));
  // bypass: the page's own modules come from the Vite server.
  await worker.start({ onUnhandledRequest: 'bypass', quiet: true });
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
