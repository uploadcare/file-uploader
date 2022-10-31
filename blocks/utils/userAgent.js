import { getUserAgent } from '@uploadcare/upload-client/browser';
import { PACKAGE_VERSION, PACKAGE_NAME } from '../../env.js';

/**
 * @param {import('@uploadcare/upload-client/browser').CustomUserAgentOptions} options
 * @returns {ReturnType<import('@uploadcare/upload-client/browser').CustomUserAgentFn>}
 */
export function customUserAgent(options) {
  return getUserAgent({
    ...options,
    libraryName: PACKAGE_NAME,
    libraryVersion: PACKAGE_VERSION,
  });
}
