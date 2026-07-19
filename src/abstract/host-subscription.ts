import { logger } from './logger';

/**
 * Generic, framework-agnostic listener set.
 *
 * Controllers use this to publish state changes without knowing anything
 * about Lit, the DOM, or the host that consumes them. The UI layer adapts
 * by passing `() => host.requestUpdate()` (or any other callback).
 */
export class Listeners {
  private _set = new Set<() => void>();

  public subscribe(listener: () => void): () => void {
    this._set.add(listener);
    return () => this._set.delete(listener);
  }

  public notify(): void {
    // Isolate each listener: one throwing subscriber must not prevent the
    // rest from being notified (e.g. block a sibling component's re-render).
    // Mirrors `EventBus.emit`'s fan-out semantics.
    for (const listener of this._set) {
      try {
        listener();
      } catch (err) {
        logger.warn('a state-change listener threw', err);
      }
    }
  }

  public clear(): void {
    this._set.clear();
  }
}
