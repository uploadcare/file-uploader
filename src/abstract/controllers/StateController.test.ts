import { describe, expect, it, vi } from 'vitest';
import { StateController } from './StateController';

type FixtureState = { a: number; b: string | null; ref: object | null };

describe('StateController', () => {
  it('exposes the seeded initial state via values/get', () => {
    const initial: FixtureState = { a: 1, b: 'x', ref: null };
    const controller = new StateController(initial);
    expect(controller.values).toBe(initial);
    expect(controller.get('a')).toBe(1);
    expect(controller.get('b')).toBe('x');
  });

  it('set() stores the value and notifies, deduping unchanged writes (Object.is)', () => {
    const controller = new StateController<FixtureState>({ a: 1, b: 'x', ref: null });
    const listener = vi.fn();
    controller.subscribe(listener);

    controller.set('a', 2);
    expect(controller.get('a')).toBe(2);
    expect(listener).toHaveBeenCalledTimes(1);

    controller.set('a', 2); // unchanged — no notify
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('set() treats NaN as equal to itself (Object.is semantics)', () => {
    const controller = new StateController<{ n: number }>({ n: NaN });
    const listener = vi.fn();
    controller.subscribe(listener);

    controller.set('n', NaN); // Object.is(NaN, NaN) === true → no notify
    expect(listener).not.toHaveBeenCalled();
  });

  it('set() treats +0 and -0 as distinct (Object.is semantics)', () => {
    const controller = new StateController<{ n: number }>({ n: 0 });
    const listener = vi.fn();
    controller.subscribe(listener);

    controller.set('n', -0); // Object.is(0, -0) === false → notifies
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('subscribe fires on every changed key, coarse (not per-key)', () => {
    const controller = new StateController<FixtureState>({ a: 1, b: 'x', ref: null });
    const listener = vi.fn();
    controller.subscribe(listener);

    controller.set('a', 2);
    controller.set('b', 'y');
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('unsubscribe stops notifications', () => {
    const controller = new StateController<FixtureState>({ a: 1, b: 'x', ref: null });
    const listener = vi.fn();
    const off = controller.subscribe(listener);
    off();

    controller.set('a', 2);
    expect(listener).not.toHaveBeenCalled();
  });

  it('notify() fires subscribers with no state change', () => {
    const controller = new StateController<FixtureState>({ a: 1, b: 'x', ref: null });
    const listener = vi.fn();
    controller.subscribe(listener);

    controller.notify();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(controller.get('a')).toBe(1);
  });

  it('destroy() clears subscribers', () => {
    const controller = new StateController<FixtureState>({ a: 1, b: 'x', ref: null });
    const listener = vi.fn();
    controller.subscribe(listener);

    controller.destroy();

    controller.set('a', 2);
    expect(listener).not.toHaveBeenCalled();
  });
});
