import { defineComponents } from './defineComponents';

export const UC_WINDOW_KEY = 'UC';

type IndexModule = Record<string, any>;

declare global {
  interface Window {
    [UC_WINDOW_KEY]?: IndexModule;
  }
}

/**
 * @param url File Uploader pack url
 * @param [register] Register connected package, if it not registered yet
 */
export function loadFileUploaderFrom(url: string, register = false): Promise<IndexModule | null> {
  return new Promise((resolve, reject) => {
    if (typeof document !== 'object') {
      resolve(null);
      return;
    }
    if (typeof window === 'object' && window[UC_WINDOW_KEY]) {
      resolve(window[UC_WINDOW_KEY]);
      return;
    }
    const script = document.createElement('script');
    script.async = true;
    script.src = url;
    script.onerror = () => {
      reject();
    };
    script.onload = () => {
      const blocks = window[UC_WINDOW_KEY] as IndexModule;
      register && defineComponents(blocks);
      resolve(blocks);
    };
    document.head.appendChild(script);
  });
}
