import { debounce } from '../utils/debounce';

const WINDOW_HEIGHT_TRACKER_PROPERTY = '--uploadcare-blocks-window-height';

// biome-ignore lint/complexity/noStaticOnlyClass: This class is static only by design
export class WindowHeightTracker {
  // Clients are just refcount keys (attach on first, detach on last) — any
  // element works; typed `HTMLElement` since `ChildBlock` instances register.
  private static clientsRegistry = new Set<HTMLElement>();

  private static flush = debounce(() => {
    document.documentElement.style.setProperty(WINDOW_HEIGHT_TRACKER_PROPERTY, `${window.innerHeight}px`);
  }, 100);

  public static registerClient(client: HTMLElement): void {
    if (WindowHeightTracker.clientsRegistry.size === 0) {
      WindowHeightTracker.attachTracker();
    }
    WindowHeightTracker.clientsRegistry.add(client);
  }

  public static unregisterClient(client: HTMLElement): void {
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
    // Cancel any pending debounced flush so a register→unregister within the
    // debounce window can't re-set the property after we remove it below.
    WindowHeightTracker.flush.cancel();
    document.documentElement.style.removeProperty(WINDOW_HEIGHT_TRACKER_PROPERTY);
  }
}
