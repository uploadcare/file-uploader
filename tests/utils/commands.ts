import { createHash, createHmac } from 'node:crypto';
import { rmSync } from 'node:fs';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { SIGNED_UPLOADS_PUBLIC_KEY, SIGNED_UPLOADS_SECRET_KEY } from '@uploadcare/api-emulator';
import type { BrowserCommand } from 'vitest/node';
import { isLive } from './network';

export const waitFileChooserAndUpload: BrowserCommand<[string[]]> = async ({ page, testPath }, relativePaths) => {
  if (!testPath) {
    throw new Error('Test path is not defined');
  }
  const fileChooserPromise = page.waitForEvent('filechooser');
  const fileChooser = await fileChooserPromise;
  const absolutePaths = relativePaths.map((relativePath) => path.join(path.dirname(testPath), relativePath));
  await fileChooser.setFiles(absolutePaths);
};

export type SecureUploadsCredentials = {
  publicKey: string;
  /** Freshly minted, so a test never waits on a token that could expire. */
  authToken: string;
};

/**
 * Which token to mint. The failures are the interesting ones: each is a
 * different `error_code` from Upload API, and the uploader has to carry it out
 * to the entry rather than flatten it into "upload failed".
 */
export type AuthTokenKind =
  | 'valid'
  /** Signed with the right key, but `exp` is in the past. */
  | 'expired'
  /** Valid, but scoped to an endpoint a plain upload does not use. */
  | 'scoped'
  /** Well-formed, signed with a key that is not the project's. */
  | 'wrong-key';

/**
 * Mints an Upload API token, in Node, where the project secret key is.
 *
 * The browser must never see that key, which is the whole point of the scheme,
 * so this is the only way an e2e test can get a token the API verifies. Against
 * the emulator that is a project the test turns Signed Uploads on for, with the
 * `signedUploads` preset; live, it is a real one.
 *
 * Returns `null` when a live run has no credentials configured, and the tests
 * that need them skip. With `E2E_REQUIRE_SECURE_UPLOADS=1`, which the CI step
 * that exists to run them sets, it throws instead: missing or rotated secrets
 * must fail that step, not leave it green with every test skipped.
 */
export const mintSecureUploadsCredentials: BrowserCommand<[AuthTokenKind?]> = async (
  _ctx,
  kind: AuthTokenKind = 'valid',
): Promise<SecureUploadsCredentials | null> => {
  const publicKey = isLive ? process.env.UPLOAD_CLIENT_SECURE_UPLOADS_PUBLIC_KEY : SIGNED_UPLOADS_PUBLIC_KEY;
  const secretKey = isLive ? process.env.UPLOAD_CLIENT_SECURE_UPLOADS_SECRET_KEY : SIGNED_UPLOADS_SECRET_KEY;
  if (!publicKey || !secretKey) {
    if (process.env.E2E_REQUIRE_SECURE_UPLOADS === '1') {
      throw new Error(
        'E2E_REQUIRE_SECURE_UPLOADS=1, but UPLOAD_CLIENT_SECURE_UPLOADS_PUBLIC_KEY or UPLOAD_CLIENT_SECURE_UPLOADS_SECRET_KEY is not set',
      );
    }
    return null;
  }

  const { generateAuthToken } = await import('@uploadcare/signed-uploads');
  const lifetime = 10 * 60 * 1000;

  switch (kind) {
    case 'expired':
      return { publicKey, authToken: mintExpiredToken(secretKey) };
    case 'scoped':
      return { publicKey, authToken: generateAuthToken(secretKey, { lifetime, scope: ['/multipart/*'] }) };
    case 'wrong-key':
      return { publicKey, authToken: generateAuthToken('not-the-project-secret-key', { lifetime }) };
    default:
      return { publicKey, authToken: generateAuthToken(secretKey, { lifetime }) };
  }
};

/**
 * `generateAuthToken` refuses to mint a token that has already expired, which
 * is the right call for a minting API and leaves this the only way to get one.
 * Signed properly, and far enough back to clear the 30 second clock leeway.
 */
const mintExpiredToken = (secretKey: string): string => {
  const issuedAt = Math.floor(Date.now() / 1000) - 3600;
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const payload = encode({ iat: issuedAt, exp: issuedAt + 60 });
  const key = createHash('sha256').update(secretKey, 'utf8').digest();
  const signature = createHmac('sha256', key).update(`${header}.${payload}`).digest('base64url');

  return `${header}.${payload}.${signature}`;
};

/**
 * Drops a real folder onto the element `selector` matches, the way the OS does: through Chromium's drag input, so
 * the page gets genuine `FileSystemDirectoryEntry` items. A drop built in JS cannot carry those — its
 * `webkitGetAsEntry()` returns null. The folder is written to a temp directory from `files` (paths relative to it).
 */
export const dropFolder: BrowserCommand<[string, Record<string, string>]> = async (ctx, selector, files) => {
  if (!('frame' in ctx)) {
    throw new Error('dropFolder needs the playwright provider');
  }
  // Kept until the run ends: the browser reads dropped files from disk lazily, while walking them and on upload.
  const root = await mkdtemp(path.join(tmpdir(), 'uc-drop-'));
  process.once('exit', () => rmSync(root, { recursive: true, force: true }));
  const folder = path.join(root, 'dropped');
  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(folder, relativePath);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, content);
  }
  const frame = await ctx.frame();
  const iframeBox = await ctx.iframe.owner().boundingBox();
  if (!iframeBox) {
    throw new Error('dropFolder: the test iframe is not visible');
  }
  const data = { items: [], files: [folder], dragOperationsMask: 1 };
  const cdp = await ctx.page.context().newCDPSession(ctx.page);
  try {
    // A drop area may only take up room once a drag is on the page, so start the drag before measuring it.
    const center = { x: iframeBox.x + iframeBox.width / 2, y: iframeBox.y + iframeBox.height / 2 };
    await cdp.send('Input.dispatchDragEvent', { type: 'dragEnter', ...center, data });
    const target = frame.locator(selector);
    await target.waitFor({ state: 'visible' });
    const box = await target.boundingBox();
    if (!box) {
      throw new Error(`dropFolder: "${selector}" is not visible`);
    }
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    for (const type of ['dragOver', 'drop'] as const) {
      await cdp.send('Input.dispatchDragEvent', { type, ...point, data });
    }
  } finally {
    await cdp.detach();
  }
};

export const commands = {
  waitFileChooserAndUpload,
  mintSecureUploadsCredentials,
  dropFolder,
};

declare module 'vitest/browser' {
  interface BrowserCommands {
    waitFileChooserAndUpload: (relativePaths: string[]) => Promise<void>;
    mintSecureUploadsCredentials: (kind?: AuthTokenKind) => Promise<SecureUploadsCredentials | null>;
    dropFolder: (selector: string, files: Record<string, string>) => Promise<void>;
  }
}
