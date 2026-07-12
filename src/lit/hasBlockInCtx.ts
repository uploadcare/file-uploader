import type { RouterController } from '../abstract/controllers/RouterController';
import type { LitActivityBlock } from './LitActivityBlock';
import type { LitBlock } from './LitBlock';
import type { BlocksRegistry } from './SharedState';

/**
 * Narrows a registry block to a {@link LitActivityBlock}. Non-activity blocks
 * (config, form-input, sources, …) carry no `activityType`, so this filters
 * them out instead of blindly casting and reading `undefined`.
 */
const isActivityBlock = (block: LitBlock): block is LitActivityBlock => 'activityType' in block;

export const hasBlockInCtx = (blocksRegistry: BlocksRegistry, callback: (block: LitBlock) => boolean): boolean => {
  for (const block of blocksRegistry) {
    if (callback(block)) {
      return true;
    }
  }
  return false;
};

export const waitForBlockInCtx = (
  blocksRegistry: BlocksRegistry,
  callback: (block: LitBlock) => boolean,
  { timeout = 1000, onTimeout }: { timeout?: number; onTimeout?: () => void } = {},
): Promise<LitBlock> => {
  return new Promise((resolve) => {
    let rafId: ReturnType<typeof requestAnimationFrame>;

    const timer = setTimeout(() => {
      cancelAnimationFrame(rafId);
      onTimeout?.();
    }, timeout);

    const check = () => {
      for (const block of blocksRegistry) {
        if (callback(block)) {
          clearTimeout(timer);
          resolve(block);
          return;
        }
      }
      rafId = requestAnimationFrame(check);
    };

    check();
  });
};

/**
 * Wait for an activity to be "mounted" — either as a ported
 * `ActivityChildBlock` (reported through the router's mounted-activity
 * signal, see `RouterController.activityBlockMounted`) or as a v1 block still
 * living in `*blocksRegistry`. Replaces the `waitForBlockInCtx` + `isActivityBlock`
 * pairing at the API's activity-wait call sites now that ported blocks are no
 * longer registry members.
 */
export const waitForActivityBlock = (
  blocksRegistry: BlocksRegistry,
  router: RouterController,
  activityType: string,
  { timeout = 1000, onTimeout }: { timeout?: number; onTimeout?: () => void } = {},
): Promise<boolean> => {
  return new Promise((resolve) => {
    let rafId: ReturnType<typeof requestAnimationFrame>;

    const timer = setTimeout(() => {
      cancelAnimationFrame(rafId);
      // Settle instead of leaving the promise pending forever (unlike the
      // legacy `waitForBlockInCtx`): callers gate on the resolved value.
      // Resolve BEFORE the callback so a throwing `onTimeout` can't leave
      // the promise pending.
      resolve(false);
      onTimeout?.();
    }, timeout);

    const check = () => {
      const found =
        router.hasMountedActivity(activityType) ||
        hasBlockInCtx(blocksRegistry, (b) => isActivityBlock(b) && b.activityType === activityType);
      if (found) {
        clearTimeout(timer);
        resolve(true);
        return;
      }
      rafId = requestAnimationFrame(check);
    };

    check();
  });
};
