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
  // TODO: collect this info on the build stage
  let libraryName = 'UploadBlocks';
  let version = '0.0.0';
  return `${libraryName}/${version}/${publicKey} (${languageName})`;
}
