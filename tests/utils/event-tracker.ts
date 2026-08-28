import type { EventKey, EventPayload } from '@/index.js';

interface CapturedEvent<T extends EventKey = EventKey> {
  type: T;
  payload: EventPayload[T];
  timestamp: number;
  index: number;
}

/**
 * EventTracker captures and validates events from DOM elements.
 * Useful for testing event sequences, counts, timing, and payloads.
 *
 * Usage:
 * ```ts
 * const tracker = new EventTracker();
 * const cleanup = tracker.attach(element);
 *
 * // Trigger action that emits events
 * await userAction();
 *
 * // Verify
 * tracker.assertSequence(['file-added', 'file-upload-start', 'file-upload-success']);
 * expect(tracker.getCount('file-upload-progress')).toBeGreaterThan(0);
 * ```
 */
export class EventTracker {
  private events: CapturedEvent[] = [];
  private listeners: Map<string, ((payload: unknown) => void)[]> = new Map();

  public attach(element: HTMLElement): () => void {
    const handler = (event: Event) => {
      if (event instanceof CustomEvent) {
        this.capture(event.type as EventKey, event.detail);
      }
    };

    element.addEventListener('*', handler);

    return () => {
      element.removeEventListener('*', handler);
    };
  }

  /**
   * Manually capture an event (used for non-DOM event sources)
   */
  public capture<T extends EventKey>(type: T, payload?: EventPayload[T]): void {
    this.events.push({
      type,
      payload: payload as EventPayload[T],
      timestamp: Date.now(),
      index: this.events.length,
    });
  }

  /**
   * Get all captured events
   */
  public getAll(): CapturedEvent[] {
    return [...this.events];
  }

  /**
   * Get sequence of event types (order only, ignores duplicates)
   */
  public getSequence(): EventKey[] {
    // Preserve order but allow duplicates for analysis
    return this.events.map((e) => e.type);
  }

  /**
   * Get count of specific event type
   */
  public getCount(type: EventKey): number {
    return this.events.filter((e) => e.type === type).length;
  }

  /**
   * Get all events of specific type
   */
  public getEvents<T extends EventKey>(type: T): CapturedEvent<T>[] {
    return this.events.filter((e) => e.type === type) as CapturedEvent<T>[];
  }

  /**
   * Alias for getEvents (used in tests)
   */
  public getAllByType<T extends EventKey>(type: T): CapturedEvent<T>[] {
    return this.getEvents(type);
  }

  /**
   * Check if event type has been captured
   */
  public has(type: EventKey): boolean {
    return this.events.some((e) => e.type === type);
  }

  /**
   * Get first event of type
   */
  public getFirst<T extends EventKey>(type: T): CapturedEvent<T> | undefined {
    return this.events.find((e) => e.type === type) as CapturedEvent<T> | undefined;
  }

  /**
   * Get last event of type
   */
  public getLast<T extends EventKey>(type: T): CapturedEvent<T> | undefined {
    const filtered = this.events.filter((e) => e.type === type);
    return filtered[filtered.length - 1] as CapturedEvent<T> | undefined;
  }

  /**
   * Get payload of first event of type
   */
  public getPayload<T extends EventKey>(type: T): EventPayload[T] | undefined {
    return this.getFirst(type)?.payload;
  }

  /**
   * Get all payloads of specific type
   */
  public getPayloads<T extends EventKey>(type: T): EventPayload[T][] {
    return this.getEvents(type).map((e) => e.payload);
  }

  /**
   * Assert that events occur in exact sequence
   */
  public assertSequence(expected: EventKey[]): void {
    const actual = this.getSequence();
    if (actual.length !== expected.length) {
      throw new Error(
        `Sequence length mismatch: expected ${expected.length}, got ${actual.length}\n` +
          `Expected: ${expected.join(' → ')}\n` +
          `Actual:   ${actual.join(' → ')}`,
      );
    }

    for (let i = 0; i < expected.length; i++) {
      if (actual[i] !== expected[i]) {
        throw new Error(
          `Event at position ${i} mismatch: expected '${expected[i]}', got '${actual[i]}'\n` +
            `Expected: ${expected.join(' → ')}\n` +
            `Actual:   ${actual.join(' → ')}`,
        );
      }
    }
  }

  /**
   * Assert that a sequence of events appears in order (may have other events between)
   */
  public assertContainsSequence(expected: EventKey[]): void {
    const actual = this.getSequence();
    let expectedIdx = 0;

    for (const eventType of actual) {
      if (eventType === expected[expectedIdx]) {
        expectedIdx++;
        if (expectedIdx === expected.length) {
          return;
        }
      }
    }

    throw new Error(
      `Sequence not found in events.\n` +
        `Expected to find: ${expected.join(' → ')}\n` +
        `Actual sequence: ${actual.join(' → ')}`,
    );
  }

  /**
   * Subscribe to a specific event type
   */
  public on<T extends EventKey>(type: T, handler: (payload: EventPayload[T]) => void): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(handler as (payload: unknown) => void);

    return () => {
      const handlers = this.listeners.get(type);
      if (handlers) {
        const idx = handlers.indexOf(handler as (payload: unknown) => void);
        if (idx > -1) {
          handlers.splice(idx, 1);
        }
      }
    };
  }

  /**
   * Get time difference between two event types (ms)
   */
  public getTimeDifference(type1: EventKey, type2: EventKey): number {
    const event1 = this.getFirst(type1);
    const event2 = this.getFirst(type2);

    if (!event1 || !event2) {
      return 0;
    }

    return event2.timestamp - event1.timestamp;
  }

  /**
   * Get duration between two event types (ms)
   */
  public getDuration(type1: EventKey, type2: EventKey): number {
    return Math.abs(this.getTimeDifference(type1, type2));
  }

  /**
   * Get timestamp for event at given index
   */
  public getTiming(index: number): number {
    return this.events[index]?.timestamp ?? 0;
  }

  /**
   * Clear all captured events
   */
  public clear(): void {
    this.events = [];
  }

  /**
   * Cleanup - alias for clear (used in tests)
   */
  public cleanup(): void {
    this.clear();
  }

  /**
   * Get debug output (formatted event log)
   */
  public debug(): string {
    if (this.events.length === 0) {
      return '[no events captured]';
    }

    const baseTime = this.events[0].timestamp;
    return this.events
      .map((e) => {
        const relativeTime = e.timestamp - baseTime;
        return `[${String(e.index).padStart(2)}] +${String(relativeTime).padStart(5)}ms ${e.type}`;
      })
      .join('\n');
  }
}
