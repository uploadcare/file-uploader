import { UC_WINDOW_KEY } from '../abstract/loadFileUploaderFrom.js';
import * as blocks from '../index.js';

declare global {
  interface Window {
    [UC_WINDOW_KEY]?: typeof blocks;
  }
}
