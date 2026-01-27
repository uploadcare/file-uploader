import type { LitBlock } from './LitBlock';
import type { BlocksRegistry } from './SharedState';

export const findBlockInCtx = (
  blocksRegistry: BlocksRegistry,
  callback: (block: LitBlock) => boolean,
): LitBlock | undefined => {
  for (const block of blocksRegistry) {
    if (callback(block)) {
      return block;
    }
  }
  return undefined;
};
