import { defineComponents } from './defineComponents';

export const UC_WINDOW_KEY = 'UC';

type IndexModule = Record<string, any>;

declare global {
  interface Window {
    [UC_WINDOW_KEY]?: IndexModule;
  }
}

/** Loads still in flight, so a second call before the first one finishes shares its `<script>`. */
const pending = new Map<string, Promise<IndexModule>>();

const loadScript = (url: string): Promise<IndexModule> => {
  const inFlight = pending.get(url);
  if (inFlight) {
    return inFlight;
  }
  const loading = new Promise<IndexModule>((resolve, reject) => {
    const script = document.createElement('script');
    script.async = true;
    script.src = url;
    script.onerror = () => {
      script.remove();
      reject(new Error(`Failed to load ${url}`));
    };
    script.onload = () => {
      resolve(window[UC_WINDOW_KEY] as IndexModule);
    };
    document.head.appendChild(script);
  }).finally(() => pending.delete(url));
  pending.set(url, loading);
  return loading;
};

/**
 * @param url File Uploader pack url
 * @param [register] Register connected package, if it not registered yet
 */
export async function loadFileUploaderFrom(url: string, register = false): Promise<IndexModule | null> {
  if (typeof document !== 'object') {
    return null;
  }
  if (typeof window === 'object' && window[UC_WINDOW_KEY]) {
    return window[UC_WINDOW_KEY];
  }
  const blocks = await loadScript(url);
  if (register) {
    defineComponents(blocks);
  }
  return blocks;
}
