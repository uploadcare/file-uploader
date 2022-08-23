import { registerBlocks } from './registerBlocks.js';

export const LR_WINDOW_KEY = '__lr-blocks__';

/**
 * @param {String} url Blocks pack url
 * @returns {Promise<import('../index.js')>}
 */
export async function connectBlocksFrom(url) {
  return new Promise((resolve, reject) => {
    if (typeof document !== 'object') {
      resolve(null);
      return;
    }
    if (typeof window === 'object' && window?.[LR_WINDOW_KEY]) {
      resolve(window[LR_WINDOW_KEY]);
      return;
    }
    let script = document.createElement('script');
    script.type = 'module';
    script.src = url;
    script.onerror = () => {
      reject();
    };
    script.onload = () => {
      /** @type {import('../index.js')} */
      let blocks = window[LR_WINDOW_KEY];
      registerBlocks(blocks);
      resolve(blocks);
    };
    document.head.appendChild(script);
  });
}
