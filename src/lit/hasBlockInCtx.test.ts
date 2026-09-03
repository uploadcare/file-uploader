import { describe, expect, it, vi } from 'vitest';
import { RouterController } from '../abstract/controllers/RouterController';
import { ControllerContainer } from '../abstract/di/ControllerContainer';
import { waitForActivityBlock } from './hasBlockInCtx';

// RouterController is container-resolved now (M-god step 3c): its emit target
// (`EventEmitter`) is `@inject`-ed, so build it through a container.
const setup = () => new ControllerContainer().get(RouterController);

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
    // Wrap `subscribe` so we can observe whether the wait's own unsubscribe
    // actually runs (rather than just asserting a no-throw, which a
    // `Set.delete`-backed unsubscribe would satisfy even if it were never
    // called — the bug this test guards against is a dropped
    // success-path `unsubscribe()` call, which leaks one router listener
    // per `waitForActivityBlock` call).
    const originalSubscribe = router.subscribe.bind(router);
    let unsubCalled = false;
    router.subscribe = (callback: () => void): (() => void) => {
      const unsubscribe = originalSubscribe(callback);
      return () => {
        unsubCalled = true;
        return unsubscribe();
      };
    };

    const pending = waitForActivityBlock(router, 'upload-list', { timeout: 1000 });
    router.activityBlockMounted('upload-list');
    await pending;

    expect(unsubCalled).toBe(true);
  });

  it('resolves false on timeout and settles even if onTimeout throws (resolve happens before onTimeout, M9f ordering)', async () => {
    vi.useFakeTimers();
    try {
      const router = setup();
      const originalSubscribe = router.subscribe.bind(router);
      let unsubCalled = false;
      router.subscribe = (callback: () => void): (() => void) => {
        const unsubscribe = originalSubscribe(callback);
        return () => {
          unsubCalled = true;
          return unsubscribe();
        };
      };

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
      expect(unsubCalled).toBe(true);

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
