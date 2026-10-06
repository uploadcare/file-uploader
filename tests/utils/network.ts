import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
// TEMPORARY: file: dependency, see package.json's "@uploadcare/api-emulator" — swap for a published version range
// once the package ships, and drop this comment.
import { resetSession, SESSION_HEADER } from '@uploadcare/api-emulator';
import { createEmulatorServer } from '@uploadcare/api-emulator/listen';
import type { Page } from 'playwright';
import type { BrowserCommand } from 'vitest/node';

/**
 * How the e2e suite talks to the network.
 *
 * By default it talks to the emulator in `@uploadcare/api-emulator` instead of the real Uploadcare, so a run needs
 * neither API access nor luck with timing, and an upload's own bytes come back out of the CDN. `E2E_NET=live`
 * redirects nothing and lets the suite hit the real service, which is what release branches run, because a fake
 * cannot tell you the API moved.
 */
export const isLive = process.env.E2E_NET === 'live';

/**
 * Everything third-party. The app's own modules must keep coming from the running Vite server, so localhost is
 * excluded, and requiring an http(s) scheme leaves `blob:`/`data:` URLs alone as well.
 *
 * Nothing else is filtered on purpose: an allowlist of known hosts would let a newly added endpoint slip through to
 * the real network unnoticed, which is exactly what the emulator exists to prevent.
 */
const thirdParty = /^https?:\/\/(?!localhost[:/]|127\.0\.0\.1[:/])/;

/** One session per page, which is one per test file. */
const sessions = new WeakMap<Page, string>();
let opened = 0;

/**
 * A throwaway certificate for the run. Playwright will only redirect a request to the same protocol it was made with
 * and the uploader speaks https, so the emulator has to as well; vitest's playwright provider already opens every
 * context with `ignoreHTTPSErrors`. openssl ships with macOS and with the CI images.
 */
const certificate = () => {
  // Real files, not /dev/stdout for both: the Linux CI runner refused that. stderr is kept so a failure says why.
  const dir = mkdtempSync(path.join(tmpdir(), 'e2e-tls-'));
  const key = path.join(dir, 'key.pem');
  const cert = path.join(dir, 'cert.pem');
  try {
    // biome-ignore format: the command reads better as it would be typed.
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=localhost', '-keyout', key, '-out', cert], { stdio: ['ignore', 'ignore', 'pipe'] });
    return { key: readFileSync(key, 'utf8'), cert: readFileSync(cert, 'utf8') };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

let started: Promise<string> | undefined;

/** Starts the emulator server on a free port, once per run, and answers with its origin. */
const emulatorOrigin = () => {
  // Unref'd: nothing here can close it after the last test, and a listening server would keep the run from exiting.
  started ??= createEmulatorServer({ tls: certificate() }).then(({ origin, unref }) => {
    unref();
    return origin;
  });
  return started;
};

/**
 * Sends the page's third-party requests to the emulator and clears whatever the last test uploaded to it. Called
 * before every test, so no test can see another's files; the redirect itself is installed once, since the page
 * outlives the test.
 *
 * Requests are redirected rather than answered in place, so that the browser still makes a real one — see
 * `createEmulatorServer` in `@uploadcare/api-emulator/listen`.
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

  const origin = await emulatorOrigin();
  await page.route(thirdParty, async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    await route.continue({
      // The emulator's server derives the request URL from `request.headers.host` + `request.url`, which is
      // path + search — both have to be carried over, or query strings (jsonerrors, pub_key, file_id, token,
      // source_url, ...) get dropped and almost every request breaks.
      url: `${origin}${url.pathname}${url.search}`,
      headers: { ...request.headers(), [SESSION_HEADER]: session },
    });

    if (process.env.E2E_NET_DEBUG) {
      console.log('[emulator]', request.method(), url.toString().slice(0, 140));
    }
  });
};
