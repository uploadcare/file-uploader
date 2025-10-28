import type { Block } from '../abstract/Block.js';
import { debounce } from '../utils/debounce.js';

const WINDOW_HEIGHT_TRACKER_PROPERTY = '--uploadcare-blocks-window-height';

// biome-ignore lint/complexity/noStaticOnlyClass: This class is static only by design
export class WindowHeightTracker {
  private static clientsRegistry = new Set<Block>();

  private static flush = debounce(() => {
    document.documentElement.style.setProperty(WINDOW_HEIGHT_TRACKER_PROPERTY, `${window.innerHeight}px`);
  }, 100);

  static registerClient(client: Block): void {
    if (WindowHeightTracker.clientsRegistry.size === 0) {
      WindowHeightTracker.attachTracker();
    }
    WindowHeightTracker.clientsRegistry.add(client);
  }

  static unregisterClient(client: Block): void {
    WindowHeightTracker.clientsRegistry.delete(client);
    if (WindowHeightTracker.clientsRegistry.size === 0) {
      WindowHeightTracker.detachTracker();
    }
  }

  private static attachTracker(): void {
    window.addEventListener('resize', WindowHeightTracker.flush, { passive: true, capture: true });
    WindowHeightTracker.flush();
  }

  private static detachTracker(): void {
    window.removeEventListener('resize', WindowHeightTracker.flush, { capture: true });
    document.documentElement.style.removeProperty(WINDOW_HEIGHT_TRACKER_PROPERTY);
  }
}
