import { beforeEach, vi } from 'vitest';
import { emulatorSession } from '~/tests/utils/emulator.browser';

/**
 * Baseline for the telemetry contract: which requests the uploader sends to the telemetry endpoint, in which order,
 * and with which payloads. They go over the network to the emulator, which answers `tlm.uploadcare.com` and keeps
 * every body it was sent on the session, so this reads them back from there.
 *
 * Live there is no emulator, and nothing to read the real endpoint's side back from, so the telemetry files run
 * against the emulator only (`vitest.config.ts` leaves them out of a live run).
 *
 * Note that `LitBlock.emit` mirrors every public event into telemetry, minus `TelemetryManager._excludedEvents`. The
 * exclusion list is asserted explicitly in the lifecycle tests, since silently starting to report per-file events would
 * be a regression.
 */

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

/** How many of this test's bodies `clearSent()` has put behind it. The emulator keeps one session, emptied per test. */
let cleared = 0;
beforeEach(() => {
  cleared = 0;
});

/** Every telemetry body the emulator received this test, since the last `clearSent()`, in order. */
export const sent = () => emulatorSession().telemetry.slice(cleared) as TelemetryBody[];

export const clearSent = () => {
  cleared = emulatorSession().telemetry.length;
};

export const types = () => sent().map((body) => body.event_type);
export const bodiesOf = (type: string) => sent().filter((body) => body.event_type === type);
export const bodiesWithAction = (event: string) => sent().filter((body) => body.payload.metadata?.event === event);
export const actionEvents = () => bodiesOf('action-event').map((body) => body.payload.metadata?.event);
export const waitForType = (type: string) =>
  vi.waitFor(() => {
    const found = bodiesOf(type)[0];
    if (!found) throw new Error(`No telemetry "${type}". Sent: ${types().join(', ')}`);
    return found;
  }, WAIT);
