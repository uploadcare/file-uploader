import { VERSION } from '../env.js';

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
  let libraryName = 'UploadBlocks';
  return `${libraryName}/${VERSION}/${publicKey} (${languageName})`;
}
