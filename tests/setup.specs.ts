/**
 * Keeps the specs project offline. Telemetry (`@uploadcare/quality-insights` posts through the global `fetch`) is
 * answered here, so the solution specs don't post to production; any other outbound request is rejected and fails
 * the test that made it, as the e2e emulator does for an unknown host.
 */
import { afterEach } from 'vitest';

const TELEMETRY_ORIGIN = 'https://tlm.uploadcare.com';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

const unexpected: string[] = [];

/** Drains the requests the guard refused, for a spec that checks it; the guard fails any test that leaves some. */
export const takeUnexpectedRequests = (): string[] => unexpected.splice(0);

const isOutbound = (url: URL): boolean =>
  (url.protocol === 'http:' || url.protocol === 'https:') && !LOCAL_HOSTS.has(url.hostname);

const refuse = (method: string, url: URL): Error => {
  unexpected.push(`${method.toUpperCase()} ${url.href}`);
  return new Error(`Specs run offline: unexpected network request ${method.toUpperCase()} ${url.href}`);
};

const realFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = new URL(input instanceof Request ? input.url : input, location.href);
  if (url.origin === TELEMETRY_ORIGIN) {
    return Promise.resolve(Response.json({}));
  }
  if (isOutbound(url)) {
    return Promise.reject(refuse(init?.method ?? (input instanceof Request ? input.method : 'GET'), url));
  }
  return realFetch(input, init);
};

const realOpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, method: string, url: string | URL, ...rest: unknown[]) {
  const target = new URL(url, location.href);
  if (isOutbound(target)) {
    throw refuse(method, target);
  }
  Reflect.apply(realOpen, this, [method, url, ...rest]);
};

afterEach(() => {
  const refused = takeUnexpectedRequests();
  if (refused.length) {
    throw new Error(`Specs run offline, but this test made network requests:\n${refused.join('\n')}`);
  }
});
