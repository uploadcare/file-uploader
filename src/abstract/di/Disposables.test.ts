import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Disposables } from './Disposables';

describe('Disposables', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('runs every registered teardown once, in registration order', () => {
    const disposables = new Disposables();
    const calls: string[] = [];
    disposables.add(() => calls.push('a'));
    disposables.add(() => calls.push('b'));
    disposables.add(() => calls.push('c'));

    disposables.run();

    expect(calls).toEqual(['a', 'b', 'c']);
  });

  it('isolate-and-warn: a throwing teardown does not stop the others', () => {
    const disposables = new Disposables();
    const before = vi.fn();
    const after = vi.fn();
    const boom = new Error('boom');
    disposables.add(before);
    disposables.add(() => {
      throw boom;
    });
    disposables.add(after);

    disposables.run();

    expect(before).toHaveBeenCalledTimes(1);
    expect(after).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith('[uc][disposables]', 'Disposables: a teardown threw', boom);
  });

  it('the canceller unregisters a fn without running it', () => {
    const disposables = new Disposables();
    const kept = vi.fn();
    const cancelled = vi.fn();
    disposables.add(kept);
    const cancel = disposables.add(cancelled);

    cancel();
    disposables.run();

    expect(kept).toHaveBeenCalledTimes(1);
    expect(cancelled).not.toHaveBeenCalled();
  });

  it('clears the registry after run — a second run() is a no-op', () => {
    const disposables = new Disposables();
    const fn = vi.fn();
    disposables.add(fn);

    disposables.run();
    expect(disposables.size).toBe(0);

    disposables.run();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('run() on an empty registry is a no-op', () => {
    const disposables = new Disposables();
    expect(() => disposables.run()).not.toThrow();
    expect(disposables.size).toBe(0);
  });

  it('size reflects registered and cancelled fns', () => {
    const disposables = new Disposables();
    expect(disposables.size).toBe(0);
    disposables.add(() => {});
    const cancel = disposables.add(() => {});
    expect(disposables.size).toBe(2);
    cancel();
    expect(disposables.size).toBe(1);
  });

  it('cancelling twice is safe', () => {
    const disposables = new Disposables();
    const cancel = disposables.add(() => {});
    cancel();
    expect(() => cancel()).not.toThrow();
    expect(disposables.size).toBe(0);
  });
});
