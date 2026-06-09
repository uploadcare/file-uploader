import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventBus } from '../../abstract/EventBus';
import type { SharedInstancesBag } from '../../lit/shared-instances';
import type { OutputFileEntry } from '../../types';
import { EventEmitter, EventType } from './EventEmitter';

// The facade reads `ctx.uploaderController().events`; stub that chain to a real
// EventBus so we exercise the actual delegation (not a mock of it).
const setup = () => {
  const bus = new EventBus();
  const ctx = { uploaderController: () => ({ events: bus }) };
  const bag = { ctx } as unknown as SharedInstancesBag;
  const emitter = new EventEmitter(bag);
  return { emitter, bus };
};

const fileEntry = (internalId: string) => ({ internalId }) as unknown as OutputFileEntry<'idle'>;

describe('EventEmitter (EventBus facade)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('delegates on/emit to the bus (immediate, value payload)', () => {
    const { emitter } = setup();
    const handler = vi.fn();
    emitter.on(EventType.FILE_ADDED, handler);

    const payload = fileEntry('a');
    emitter.emit(EventType.FILE_ADDED, payload);

    expect(handler).toHaveBeenCalledWith(payload);
  });

  it('resolves a function payload before dispatching (immediate)', () => {
    const { emitter } = setup();
    const handler = vi.fn();
    emitter.on(EventType.FILE_ADDED, handler);

    const payload = fileEntry('b');
    // A thunk payload is allowed even without debounce; it must be resolved.
    emitter.emit(EventType.FILE_ADDED, (() => payload) as never);

    expect(handler).toHaveBeenCalledWith(payload);
  });

  it('debounces with the default 20ms window and coalesces to one dispatch', () => {
    const { emitter } = setup();
    const handler = vi.fn();
    emitter.on(EventType.CHANGE, handler);

    emitter.emit(EventType.CHANGE, () => fileEntry('1') as never, { debounce: true });
    emitter.emit(EventType.CHANGE, () => fileEntry('2') as never, { debounce: true });
    expect(handler).not.toHaveBeenCalled();

    vi.advanceTimersByTime(20);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ internalId: '2' }));
  });

  it('honors a numeric debounce window', () => {
    const { emitter } = setup();
    const handler = vi.fn();
    emitter.on(EventType.COMMON_UPLOAD_PROGRESS, handler);

    emitter.emit(EventType.COMMON_UPLOAD_PROGRESS, () => fileEntry('p') as never, { debounce: 100 });

    vi.advanceTimersByTime(50);
    expect(handler).not.toHaveBeenCalled();
    vi.advanceTimersByTime(50);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('stops notifying after the returned unsubscribe is called', () => {
    const { emitter } = setup();
    const handler = vi.fn();
    const unsubscribe = emitter.on(EventType.FILE_ADDED, handler);

    unsubscribe();
    emitter.emit(EventType.FILE_ADDED, fileEntry('c'));

    expect(handler).not.toHaveBeenCalled();
  });
});
