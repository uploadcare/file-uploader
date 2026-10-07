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
import { setupEmulator } from '@uploadcare/api-emulator/browser';

/** The page-side flag; `./network.ts` is the Node side. */
export const isLive = import.meta.env.E2E_NET === 'live';

// Starts once per test file, on the first reset.
const emulator = isLive ? undefined : setupEmulator();

/**
 * Clears what the last test did and answers the fresh session, for a test to steer with `use()`/`on()`.
 * `undefined` live, where there is nothing to reset.
 */
export const resetEmulator = () => emulator?.reset();
