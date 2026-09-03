import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ControllerContainer } from '../../abstract/di/ControllerContainer';
import { EventBus } from '../../abstract/EventBus';
import type { OutputFileEntry } from '../../types';
import { EventEmitter, EventType } from './EventEmitter';

// The facade is container-resolved now (M-god step 3b): a zero-arg ctor that
// `@inject`s the per-ctx `EventBus`. Build both through one throwaway container
// so we exercise the actual delegation to a real bus (not a mock of it).
const setup = () => {
  const container = new ControllerContainer();
  const bus = container.get(EventBus);
  const emitter = container.get(EventEmitter);
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
    emitter.emit(EventType.FILE_ADDED, () => payload);

    expect(handler).toHaveBeenCalledWith(payload);
  });

  it('debounces with the default 20ms window and coalesces to one dispatch', () => {
    const { emitter } = setup();
    const handler = vi.fn();
    emitter.on(EventType.FILE_ADDED, handler);

    emitter.emit(EventType.FILE_ADDED, () => fileEntry('1'), { debounce: true });
    emitter.emit(EventType.FILE_ADDED, () => fileEntry('2'), { debounce: true });
    expect(handler).not.toHaveBeenCalled();

    vi.advanceTimersByTime(20);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ internalId: '2' }));
  });

  it('honors a numeric debounce window', () => {
    const { emitter } = setup();
    const handler = vi.fn();
    emitter.on(EventType.FILE_ADDED, handler);

    emitter.emit(EventType.FILE_ADDED, () => fileEntry('p'), { debounce: 100 });

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
