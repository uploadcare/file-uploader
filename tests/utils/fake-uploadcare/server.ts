import { execFileSync } from 'node:child_process';
import type { IncomingMessage } from 'node:http';
import { createServer } from 'node:https';
import type { AddressInfo } from 'node:net';
import { getResponse } from 'msw';
import { handlers } from './index';

/**
 * The fake, behind a real server on localhost.
 *
 * Answering from inside Playwright's `route.fulfill` would be less machinery, but the browser then never puts the
 * request on the wire, and an XHR that is never sent reports no upload progress — the uploader's own
 * `file-upload-progress` event would stop firing, and the tests that assert it would be asserting the harness rather
 * than the app. Requests are redirected here instead, so the browser makes a real one and everything downstream of
 * it, progress included, happens the way it does against the real service.
 */

/**
 * A throwaway certificate for the run. Playwright will only redirect a request to the same protocol it was made with
 * and the uploader speaks https, so the fake has to as well; vitest's playwright provider already opens every context
 * with `ignoreHTTPSErrors`. openssl ships with macOS and with the CI images.
 */
const certificate = () => {
  // biome-ignore format: the command reads better as it would be typed.
  const pem = execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=localhost', '-keyout', '/dev/stdout', '-out', '/dev/stdout'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const boundary = pem.indexOf('-----BEGIN CERTIFICATE-----');
  return { key: pem.slice(0, boundary), cert: pem.slice(boundary) };
};

/** The URL the browser originally asked for, which is what the handlers match on. */
export const ORIGINAL_URL = 'x-fake-uploadcare-url';

const bodyOf = async (request: IncomingMessage) => {
  if (request.method === 'GET' || request.method === 'HEAD') {
    return null;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(chunk as Buffer);
  }
  return new Uint8Array(Buffer.concat(chunks));
};

const headersOf = (request: IncomingMessage) => {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (value !== undefined && name !== ORIGINAL_URL) {
      headers.set(name, Array.isArray(value) ? value.join(', ') : value);
    }
  }
  return headers;
};

let started: Promise<string> | undefined;

/** Starts the server on a free port, once per run, and answers with its origin. */
export const fakeServerOrigin = () => {
  started ??= new Promise<string>((resolve, reject) => {
    const server = createServer(certificate(), async (request, response) => {
      const url = request.headers[ORIGINAL_URL];
      if (typeof url !== 'string') {
        response.writeHead(400).end(`missing ${ORIGINAL_URL}`);
        return;
      }

      const answer = await getResponse(
        handlers,
        new Request(url, { method: request.method, headers: headersOf(request), body: await bodyOf(request) }),
      );

      if (!answer) {
        // Nothing the fake knows about. A test that starts calling something new fails here rather than reaching the
        // real internet; `E2E_NET_DEBUG=1` says what it asked for.
        if (process.env.E2E_NET_DEBUG) {
          console.log('[unhandled]', `${request.method} ${url}`.slice(0, 140));
        }
        response.writeHead(502).end('not handled by the fake uploadcare');
        return;
      }

      if (process.env.E2E_NET_DEBUG) {
        console.log('[fake]', answer.status, `${request.method} ${url}`.slice(0, 120));
      }

      // The page is served from localhost and this is 127.0.0.1, so every answer is cross-origin.
      const headers = Object.fromEntries(answer.headers);
      response.writeHead(answer.status, { ...headers, 'access-control-allow-origin': '*' });
      response.end(Buffer.from(await answer.arrayBuffer()));
    });

    server.on('error', reject);
    // Nothing should be kept alive by a test double.
    server.unref();
    server.listen(0, '127.0.0.1', () => {
      resolve(`https://127.0.0.1:${(server.address() as AddressInfo).port}`);
    });
  });

  return started;
};
