import type { Page } from 'playwright';
import type { BrowserCommand } from 'vitest/node';
import { resetSession, SESSION_HEADER } from './fake-uploadcare/index';
import { fakeServerOrigin, ORIGINAL_URL } from './fake-uploadcare/server';

/**
 * How the e2e suite talks to the network.
 *
 * By default it talks to the fake Uploadcare in `fake-uploadcare/` instead of the real one, so a run needs neither
 * API access nor luck with timing, and an upload's own bytes come back out of the CDN. `E2E_NET=live` redirects
 * nothing and lets the suite hit the real service, which is what release branches run, because a fake cannot tell you
 * the API moved.
 */
export const isLive = process.env.E2E_NET === 'live';

/**
 * Everything third-party. The app's own modules must keep coming from the running Vite server, so localhost is
 * excluded, and requiring an http(s) scheme leaves `blob:`/`data:` URLs alone as well.
 *
 * Nothing else is filtered on purpose: an allowlist of known hosts would let a newly added endpoint slip through to
 * the real network unnoticed, which is exactly what the fake exists to prevent.
 */
const thirdParty = /^https?:\/\/(?!localhost[:/]|127\.0\.0\.1[:/])/;

/** One session per page, which is one per test file — see `fake-uploadcare/files.ts`. */
const sessions = new WeakMap<Page, string>();
let opened = 0;

/**
 * Sends the page's third-party requests to the fake and clears whatever the last test uploaded to it. Called before
 * every test, so no test can see another's files; the redirect itself is installed once, since the page outlives the
 * test.
 *
 * Requests are redirected rather than answered in place, so that the browser still makes a real one — see
 * `fake-uploadcare/server.ts`.
 */
export const useFakeNetwork: BrowserCommand<[]> = async ({ page }) => {
  if (isLive) {
    return;
  }

  const existing = sessions.get(page);
  if (existing) {
    resetSession(existing);
    return;
  }

  const session = `session-${++opened}`;
  sessions.set(page, session);
  resetSession(session);

  const origin = await fakeServerOrigin();
  await page.route(thirdParty, async (route) => {
    const url = route.request().url();
    await route.continue({
      // The path is carried over so that a failed request still names something recognisable in the devtools.
      url: `${origin}${new URL(url).pathname}`,
      headers: { ...route.request().headers(), [ORIGINAL_URL]: url, [SESSION_HEADER]: session },
    });
  });
};
