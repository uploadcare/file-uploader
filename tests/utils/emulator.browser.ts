// TEMPORARY: file: dependency, see package.json's "@uploadcare/api-emulator" — swap for a published version range
// once the package ships, and drop this comment.
import { setupEmulator } from '@uploadcare/api-emulator/browser';

/**
 * The fake Uploadcare, running in the page: `@uploadcare/api-emulator/browser` answers Uploadcare's hosts, lets the
 * page's own origin (the Vite server) through and fails every other request loudly, so a new or mistyped endpoint
 * cannot slip out to the real service. msw and @mswjs/interceptors are its peers, installed here as devDependencies;
 * interceptors must be 0.45.x for per-chunk upload progress.
 *
 * `E2E_NET=live` leaves the page alone and lets the suite hit the real service; see `./network.ts`.
 */
/** The page-side flag; `./network.ts` is the Node side. */
export const isLive = import.meta.env.E2E_NET === 'live';

const emulator = isLive ? undefined : setupEmulator();

/** Starts the emulator once per page (one per test file) and clears what the last test uploaded. Live runs touch nothing. */
export const useEmulator = async () => {
  await emulator?.reset();
};
