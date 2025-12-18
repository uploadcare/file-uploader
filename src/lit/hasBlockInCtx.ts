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
