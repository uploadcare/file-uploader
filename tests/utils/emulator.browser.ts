// TEMPORARY: file: dependency, see package.json's "@uploadcare/api-emulator" — swap for a published version range
// once the package ships, and drop this comment.

/**
 * The fake Uploadcare, running in the page: `@uploadcare/api-emulator/browser` answers Uploadcare's hosts, lets the
 * page's own origin (the Vite server) through and fails every other request loudly, so a new or mistyped endpoint
 * cannot slip out to the real service. msw and @mswjs/interceptors are its peers, installed here as devDependencies;
 * interceptors must be 0.45.x for per-chunk upload progress.
 *
 * `E2E_NET=live` leaves the page alone and lets the suite hit the real service; see `./network.ts`.
 */
import type { EmulatorSession } from '@uploadcare/api-emulator';
import { setupEmulator } from '@uploadcare/api-emulator/browser';

/** The page-side flag; `./network.ts` is the Node side. */
export const isLive = import.meta.env.E2E_NET === 'live';

// Starts once per test file, on the first reset.
const emulator = isLive ? undefined : setupEmulator();

let current: EmulatorSession | undefined;

/**
 * Clears what the last test did and answers the fresh session, for a test to steer with `use()`/`on()`.
 * `undefined` live, where there is nothing to reset.
 */
export const resetEmulator = async () => {
  current = await emulator?.reset();
  return current;
};

/**
 * The running test's session: what it received (`files`, `telemetry`, `requests`) and the scenarios that steer it.
 * Live there is none, so a test that reads or steers it runs against the emulator only, under `it.skipIf(isLive)`.
 */
export const emulatorSession = (): EmulatorSession => {
  if (!current) {
    throw new Error('No emulator session: E2E_NET=live has no emulator, so skip this test with it.skipIf(isLive)');
  }
  return current;
};
