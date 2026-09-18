import { type MockInstance, vi } from 'vitest';

/**
 * Baseline for the telemetry contract: which requests the uploader sends to the telemetry endpoint, in which order,
 * and with which payloads. Nothing leaves the browser — `fetch` to the telemetry host is stubbed out.
 *
 * Note that `LitBlock.emit` mirrors every public event into telemetry, minus `TelemetryManager._excludedEvents`. The
 * exclusion list is asserted explicitly in the lifecycle tests, since silently starting to report per-file events would
 * be a regression.
 */

const TELEMETRY_URL = 'https://tlm.uploadcare.com/api/v1/events';
/** Longer than the 300ms output flush, so trailing telemetry has been queued and sent. */
export const SETTLE_MS = 1000;
const WAIT = { timeout: 20_000, interval: 50 };

/** Telemetry bodies are snake_cased on the way out. */
export type TelemetryBody = {
  event_type: string;
  session_id: string;
  app_name: string;
  app_version: string;
  component: string | null;
  activity: string | null;
  project_pubkey: string;
  config?: Record<string, unknown>;
  payload: { location: string; metadata?: Record<string, unknown> & { event?: string }; [key: string]: unknown };
};

/** Every telemetry body sent since the last `installTelemetryStub()` / `clearSent()`, in order. */
export const sent: TelemetryBody[] = [];

export const clearSent = () => {
  sent.length = 0;
};

let fetchSpy: MockInstance<typeof window.fetch> | undefined;

/** Routes telemetry `fetch` calls into `sent` and lets everything else through. Restores the previous stub first. */
export function installTelemetryStub(): void {
  fetchSpy?.mockRestore();
  clearSent();
  const originalFetch = window.fetch.bind(window);
  fetchSpy = vi.spyOn(window, 'fetch').mockImplementation((input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!url.startsWith(TELEMETRY_URL)) {
      return originalFetch(input, init);
    }
    sent.push(JSON.parse(String(init?.body)) as TelemetryBody);
    return Promise.resolve(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
  });
}

export const types = () => sent.map((body) => body.event_type);
export const bodiesOf = (type: string) => sent.filter((body) => body.event_type === type);
export const bodiesWithAction = (event: string) => sent.filter((body) => body.payload.metadata?.event === event);
export const actionEvents = () => bodiesOf('action-event').map((body) => body.payload.metadata?.event);
export const waitForType = (type: string) =>
  vi.waitFor(() => {
    const found = bodiesOf(type)[0];
    if (!found) throw new Error(`No telemetry "${type}". Sent: ${types().join(', ')}`);
    return found;
  }, WAIT);
