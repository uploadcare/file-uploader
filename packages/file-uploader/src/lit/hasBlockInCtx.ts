import type { LitBlock } from './LitBlock';
import type { BlocksRegistry } from './SharedState';

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
