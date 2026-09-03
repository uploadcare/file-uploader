import type { RouterController } from '../abstract/controllers/RouterController';
import type { ActivityId } from './activity-constants';

/**
 * Wait for an activity to be "mounted" — reported through the router's
 * mounted-activity signal (see `RouterController.activityBlockMounted`,
 * refcounted by `ActivityChildBlock`). Now that every activity-carrying block
 * is a ported `ActivityChildBlock`, this rides the router's `subscribe` signal
 * alone instead of polling a registry.
 */
export const waitForActivityBlock = (
  router: RouterController,
  activityType: ActivityId,
  { timeout = 1000, onTimeout }: { timeout?: number; onTimeout?: () => void } = {},
): Promise<boolean> => {
  return new Promise((resolve) => {
    if (router.hasMountedActivity(activityType)) {
      resolve(true);
      return;
    }

    let unsubscribe: () => void;

    const timer = setTimeout(() => {
      unsubscribe();
      // Settle instead of leaving the promise pending forever: callers gate
      // on the resolved value. Resolve BEFORE the callback so a throwing
      // `onTimeout` can't leave the promise pending.
      resolve(false);
      onTimeout?.();
    }, timeout);

    unsubscribe = router.subscribe(() => {
      if (!router.hasMountedActivity(activityType)) {
        return;
      }
      clearTimeout(timer);
      unsubscribe();
      resolve(true);
    });
  });
};
