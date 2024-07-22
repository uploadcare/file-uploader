import { registerBlocks } from './registerBlocks.js';

export const UC_WINDOW_KEY = 'UC';

/**
 * @param {String} url Blocks pack url
 * @param {Boolean} [register] Register connected package, if it not registered yet
 * @returns {Promise<import('../index.js')>}
 */
export async function connectBlocksFrom(url, register = false) {
  return new Promise((resolve, reject) => {
    if (typeof document !== 'object') {
      resolve(null);
      return;
    }
    if (typeof window === 'object' && window[UC_WINDOW_KEY]) {
      resolve(window[UC_WINDOW_KEY]);
      return;
    }
    let script = document.createElement('script');
    script.async = true;
    script.src = url;
    script.onerror = () => {
      reject();
    };
    script.onload = () => {
      /** @type {import('../index.js')} */
      let blocks = window[UC_WINDOW_KEY];
      register && registerBlocks(blocks);
      resolve(blocks);
    };
    document.head.appendChild(script);
  });
}
