import { vi } from 'vitest';
import type { EventKey, EventPayload } from '@/blocks/UploadCtxProvider/EventEmitter';
import { EventType } from '@/blocks/UploadCtxProvider/EventEmitter';

/** Real uploads run against the network, so waiting for a terminal event needs more than vitest's 1s default. */
const WAIT_TIMEOUT = { timeout: 20_000, interval: 50 };

export type RecordedEvent = { type: EventKey; detail: unknown };

/**
 * Events that are emitted repeatedly while a single upload runs. Their count depends on network timing, so consecutive
 * occurrences are collapsed into one entry in `types`.
 */
const COLLAPSIBLE: readonly EventKey[] = [EventType.FILE_UPLOAD_PROGRESS, EventType.COMMON_UPLOAD_PROGRESS];

export type EventRecorder = ReturnType<typeof recordEvents>;

/** Records every public uploader event fired on `target`, in order. */
export function recordEvents(target: EventTarget) {
  const events: RecordedEvent[] = [];

  for (const type of Object.values(EventType)) {
    target.addEventListener(type, (e: Event) => {
      events.push({ type, detail: (e as CustomEvent).detail });
    });
  }

  return {
    events,

    /** Ordered event types, with consecutive duplicates of timing-dependent events collapsed. */
    get types(): EventKey[] {
      return events
        .map((event) => event.type)
        .filter((type, index, all) => !(index > 0 && all[index - 1] === type && COLLAPSIBLE.includes(type)));
    },

    /** Ordered event types with `omit` types filtered out, on top of the collapsing done by `types`. */
    typesExcluding(...omit: EventKey[]): EventKey[] {
      return this.types.filter((type) => !omit.includes(type));
    },

    /** Payloads of every occurrence of `type`, in order. */
    detailsOf<T extends EventKey>(type: T): EventPayload[T][] {
      return events.filter((event) => event.type === type).map((event) => event.detail as EventPayload[T]);
    },

    /** Payload of the first occurrence of `type`, waiting for it to fire. */
    waitFor<T extends EventKey>(type: T): Promise<EventPayload[T]> {
      return vi.waitFor(() => {
        const found = events.find((event) => event.type === type);
        if (!found) {
          throw new Error(`Event "${type}" was not fired. Recorded: ${events.map((e) => e.type).join(', ')}`);
        }
        return found.detail as EventPayload[T];
      }, WAIT_TIMEOUT);
    },

    clear(): void {
      events.length = 0;
    },
  };
}
