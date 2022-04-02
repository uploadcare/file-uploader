import { VERSION, PACKAGE_NAME } from '../../env.js';
import { toPascalCase } from './toPascalCase.js';

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
  let libraryName = toPascalCase(PACKAGE_NAME);
  return `${libraryName}/${VERSION}/${publicKey} (${languageName})`;
}
