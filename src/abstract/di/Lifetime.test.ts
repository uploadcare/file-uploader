import { describe, expect, it, vi } from 'vitest';
import { isAbortError, Lifetime } from './Lifetime';

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('Lifetime', () => {
  it('starts live and aborts its signal once ended', () => {
    const lifetime = new Lifetime();
    expect(lifetime.signal.aborted).toBe(false);

    lifetime.end();

    expect(lifetime.signal.aborted).toBe(true);
    expect(isAbortError(lifetime.signal.reason)).toBe(true);
  });

  it('can be created already ended', () => {
    expect(Lifetime.ended().signal.aborted).toBe(true);
  });

  describe('guard', () => {
    it('passes the value through while the lifetime is live', async () => {
      await expect(new Lifetime().guard(Promise.resolve(42))).resolves.toBe(42);
    });

    it('passes a rejection through while the lifetime is live', async () => {
      const error = new Error('boom');
      await expect(new Lifetime().guard(Promise.reject(error))).rejects.toBe(error);
    });

    it('aborts and disposes a value that settles after the lifetime ended', async () => {
      const lifetime = new Lifetime();
      const work = deferred<string>();
      const dispose = vi.fn();
      const guarded = lifetime.guard(work.promise, dispose);

      lifetime.end();
      work.resolve('stream');

      await expect(guarded).rejects.toSatisfy(isAbortError);
      expect(dispose).toHaveBeenCalledWith('stream');
    });

    it('turns a rejection after the lifetime ended into an abort', async () => {
      const lifetime = new Lifetime();
      const work = deferred<string>();
      const guarded = lifetime.guard(work.promise);

      lifetime.end();
      work.reject(new Error('late failure'));

      await expect(guarded).rejects.toSatisfy(isAbortError);
    });

    it('aborts straight away on an ended lifetime', async () => {
      const dispose = vi.fn();
      await expect(Lifetime.ended().guard(Promise.resolve(1), dispose)).rejects.toSatisfy(isAbortError);
      expect(dispose).toHaveBeenCalledWith(1);
    });
  });

  describe('run', () => {
    it('starts the task synchronously with the lifetime signal', () => {
      const lifetime = new Lifetime();
      const task = vi.fn(async () => {});

      lifetime.run(task, () => {});

      expect(task).toHaveBeenCalledWith(lifetime.signal);
    });

    it('swallows the abort of a guarded await and stops the task there', async () => {
      const lifetime = new Lifetime();
      const onError = vi.fn();
      const after = vi.fn();
      const work = deferred<void>();
      let settled!: () => void;
      const done = new Promise<void>((res) => {
        settled = res;
      });

      lifetime.run(async () => {
        try {
          await lifetime.guard(work.promise);
          after();
        } finally {
          settled();
        }
      }, onError);
      lifetime.end();
      work.resolve();
      await done;
      await Promise.resolve();

      expect(after).not.toHaveBeenCalled();
      expect(onError).not.toHaveBeenCalled();
    });

    it('reports any other error', async () => {
      const error = new Error('boom');
      const onError = vi.fn();

      new Lifetime().run(async () => {
        throw error;
      }, onError);

      await vi.waitFor(() => expect(onError).toHaveBeenCalledWith(error));
    });

    it('reports a synchronous throw', async () => {
      const error = new Error('sync');
      const onError = vi.fn();

      new Lifetime().run(() => {
        throw error;
      }, onError);

      await vi.waitFor(() => expect(onError).toHaveBeenCalledWith(error));
    });
  });
});
