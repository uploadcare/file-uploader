import { describe, expect, it, vi } from 'vitest';
import { RouterController } from '../abstract/controllers/RouterController';
import { waitForActivityBlock } from './hasBlockInCtx';

const setup = () => new RouterController({ emit: vi.fn() });

describe('waitForActivityBlock', () => {
  it('resolves true synchronously when the activity is already mounted', async () => {
    const router = setup();
    router.activityBlockMounted('upload-list');

    await expect(waitForActivityBlock(router, 'upload-list')).resolves.toBe(true);
  });

  it('resolves true once the activity mounts after a later router notification', async () => {
    const router = setup();

    const pending = waitForActivityBlock(router, 'upload-list', { timeout: 1000 });

    // A router notification unrelated to this activity must not resolve it.
    router.navigate('start-from');
    router.activityBlockMounted('upload-list');

    await expect(pending).resolves.toBe(true);
  });

  it('unsubscribes from the router once resolved, so later notifications are inert', async () => {
    const router = setup();
    const subscribeSpy = vi.spyOn(router, 'subscribe');

    const pending = waitForActivityBlock(router, 'upload-list', { timeout: 1000 });
    router.activityBlockMounted('upload-list');
    await pending;

    expect(subscribeSpy).toHaveBeenCalledTimes(1);
    const unsubscribe = subscribeSpy.mock.results[0]?.value as () => void;
    const unsubscribeSpy = vi.fn(unsubscribe);
    // Sanity: calling the returned unsubscribe again must not throw (Listeners
    // tolerates redundant unsubscribes) — proves teardown already happened.
    expect(() => unsubscribeSpy()).not.toThrow();
  });

  it('resolves false on timeout and settles even if onTimeout throws (resolve happens before onTimeout, M9f ordering)', async () => {
    vi.useFakeTimers();
    try {
      const router = setup();

      const pending = waitForActivityBlock(router, 'upload-list', {
        timeout: 50,
        onTimeout: () => {
          throw new Error('boom');
        },
      });

      // A throwing `onTimeout` runs synchronously inside the timer callback,
      // uncaught — it must not prevent (or reject) the already-resolved
      // promise, proving `resolve(false)` ran first.
      await expect(vi.advanceTimersByTimeAsync(50)).rejects.toThrow('boom');
      await expect(pending).resolves.toBe(false);

      // A late mount after timeout must not throw or double-resolve.
      expect(() => router.activityBlockMounted('upload-list')).not.toThrow();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not resolve for a mount of a different activity', async () => {
    vi.useFakeTimers();
    try {
      const router = setup();
      const onTimeout = vi.fn();

      const pending = waitForActivityBlock(router, 'upload-list', { timeout: 50, onTimeout });
      router.activityBlockMounted('start-from');

      vi.advanceTimersByTime(50);
      await vi.runAllTimersAsync();

      await expect(pending).resolves.toBe(false);
      expect(onTimeout).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
