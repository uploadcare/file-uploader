import { debounce } from '../blocks/utils/debounce.js';

const WINDOW_HEIGHT_TRACKER_PROPERTY = '--uploadcare-blocks-window-height';
const WINDOW_CACHE_KEY = '__UPLOADCARE_BLOCKS_WINDOW_HEIGHT_TRACKER_ENABLED__';

export function getIsWindowHeightTracked() {
  return typeof window[WINDOW_CACHE_KEY] === 'undefined' ? false : !!window[WINDOW_CACHE_KEY];
}

export function createWindowHeightTracker() {
  if (getIsWindowHeightTracked()) {
    return;
  }
  const callback = () => {
    document.documentElement.style.setProperty(WINDOW_HEIGHT_TRACKER_PROPERTY, `${window.innerHeight}px`);
    window[WINDOW_CACHE_KEY] = true;
  };
  const debouncedCallback = debounce(callback, 100);
  window.addEventListener('resize', debouncedCallback, { passive: true });
  callback();

  return () => {
    window[WINDOW_CACHE_KEY] = false;
    window.removeEventListener('resize', debouncedCallback);
  };
}
