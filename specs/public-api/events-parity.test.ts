import { describe, expect, it } from 'vitest';
import { EventType, InternalEventType } from '@/blocks/UploadCtxProvider/EventEmitter';
import surface from './public-surface.json' with { type: 'json' };

/**
 * `events.mdx` is the public event contract. `tests/events.e2e.test.tsx` pins the order they fire in; this pins the
 * set of names, which is cheap enough to check without a browser.
 */

describe('documented events', () => {
  const documented = [...surface.events].sort();
  const implemented = Object.values(EventType).sort();

  it('match the implemented EventType exactly', () => {
    expect(implemented).toEqual(documented);
  });

  it('do not leak internal event types into the public set', () => {
    // InternalEventType feeds telemetry and must never reach `EventType`, or it would start dispatching on
    // <uc-upload-ctx-provider> as a documented event.
    const internal = Object.values(InternalEventType) as string[];
    expect(implemented.filter((type) => internal.includes(type))).toEqual([]);
  });
});
