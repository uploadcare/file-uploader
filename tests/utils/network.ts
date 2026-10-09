/**
 * How the e2e suite talks to the network.
 *
 * By default it talks to the emulator in `@uploadcare/api-emulator`, run inside the page by `./emulator.browser.ts`,
 * instead of the real Uploadcare, so a run needs neither API access nor luck with timing, and an upload's own bytes
 * come back out of the CDN. `E2E_NET=live` installs nothing and lets the suite hit the real service, which is what
 * release branches run, because a fake cannot tell you the API moved.
 *
 * This is the Node side: `vitest.config.ts` reads `isLive` for its retry policy and passes `mode` to the page.
 */
export const mode = process.env.E2E_NET || 'fake';
if (mode !== 'fake' && mode !== 'live') {
  throw new Error(`E2E_NET must be 'fake' or 'live', got '${mode}'`);
}
export const isLive = mode === 'live';
