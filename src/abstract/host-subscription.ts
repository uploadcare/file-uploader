import { logger } from './logger';

const log = logger.scope('host-subscription');

/** Options for an atomic `observe` subscription. */
export interface ObserveOptions {
  /** Also fire the listener once with the current value on subscribe. */
  immediate?: boolean;
}

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

  /**
   * Atomic derived-value subscription over the coarse notify: filters it down to
   * a single value produced by `select()`, invoking `listener` only when that
   * value actually changes (`Object.is` dedup) — so callers don't hand-roll the
   * last-value comparison. Pass `{ immediate: true }` to also fire once with the
   * current value on subscribe. Returns an unsubscriber.
   *
   * This is the shared engine behind `SignalMap.observe` (select = a keyed read)
   * and the controllers' derived observes (e.g. `RouterController.observeCurrentActivity`).
   */
  public observe<T>(select: () => T, listener: (value: T) => void, options?: ObserveOptions): () => void {
    let last = select();
    if (options?.immediate) {
      listener(last);
    }
    return this.subscribe(() => {
      const next = select();
      if (!Object.is(next, last)) {
        last = next;
        listener(next);
      }
    });
  }

  public notify(): void {
    // Isolate each listener: one throwing subscriber must not prevent the
    // rest from being notified (e.g. block a sibling component's re-render).
    // Mirrors `EventBus.emit`'s fan-out semantics.
    for (const listener of this._set) {
      try {
        listener();
      } catch (err) {
        log.warn('a state-change listener threw', err);
      }
    }
  }

  public clear(): void {
    this._set.clear();
  }
}
