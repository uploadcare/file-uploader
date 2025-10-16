import { describe, expect, it } from 'vitest';
import { withResolvers } from './withResolvers';

describe('withResolvers', () => {
  it('resolves when external resolve is called', async () => {
    const { promise, resolve } = withResolvers() as {
      promise: Promise<unknown>;
      resolve: (value?: unknown) => void;
    };

    setTimeout(() => resolve(42), 10);

    const result = await promise;
    expect(result).toBe(42);
  });

  it('rejects when external reject is called', async () => {
    const { promise, reject } = withResolvers() as {
      promise: Promise<unknown>;
      reject: (reason?: unknown) => void;
    };

    setTimeout(() => reject(new Error('fail')), 10);

    try {
      await promise;
      throw new Error('Promise should have been rejected');
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toBe('fail');
    }
  });

  it('resolves with a promise-like value (flattened)', async () => {
    const { promise, resolve } = withResolvers() as {
      promise: Promise<unknown>;
      resolve: (value?: unknown) => void;
    };

    setTimeout(() => resolve(Promise.resolve('ok')), 10);

    const result = await promise;
    expect(result).toBe('ok');
  });
});
