// @ts-check
import * as blocks from './index.js';
import { LR_WINDOW_KEY } from './abstract/connectBlocksFrom.js';

blocks.registerBlocks(blocks);
window[LR_WINDOW_KEY] = blocks;

export {};
