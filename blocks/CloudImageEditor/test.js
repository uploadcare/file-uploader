import { ifRef } from '../../utils/ifRef.js';
import * as blocks from '../../index.js';

ifRef(() => {
  blocks.registerBlocks(blocks);
  document.querySelector(blocks.CloudEditor.is)?.addEventListener('apply', (e) => {
    console.log(e);
  });
});
