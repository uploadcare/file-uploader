import { HttpResponse, http } from 'msw';
import { cdn } from './cdn';
import { uploadApi } from './upload-api';

export { resetSession, SESSION_HEADER } from './files';

/**
 * A stand-in for Uploadcare that behaves like the service instead of repeating a recording of it: an upload is
 * stored, gets an id, and is then described by `/info/` and delivered by the CDN. What a test uploads is what it
 * gets back.
 *
 * It runs in node, on the Playwright side of the browser, and answers whatever the page asks for over the network.
 * `tests/utils/network.ts` is the wiring; this is the service.
 *
 * Only the endpoints the suite calls are here. Anything else is left unhandled and the request is aborted, so a test
 * that starts talking to something new fails loudly rather than quietly reaching the real internet.
 */
export const handlers = [
  ...uploadApi,
  ...cdn,

  /**
   * Telemetry is fire-and-forget and nothing asserts on it from the wire — the tests that cover it stub `fetch` in
   * the page. It only needs to not fail.
   */
  http.post('https://tlm.uploadcare.com/api/v1/events', () => HttpResponse.json({})),
];
