import { PACKAGE_VERSION, PACKAGE_NAME } from '../../env.js';

/**
 * @param {{
 *   publicKey: string;
 *   libraryName: string;
 *   libraryVersion: string;
 *   languageName: string;
 *   integration?: string;
 * }} options
 * @returns {string}
 */
export function customUserAgent({ publicKey, languageName }) {
  return `${PACKAGE_NAME}/${PACKAGE_VERSION}/${publicKey} (${languageName})`;
}
