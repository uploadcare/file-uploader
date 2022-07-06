import * as blocks from '../../index.js';

blocks.registerBlocks(blocks);

window.addEventListener('DOMContentLoaded', () => {
  document.querySelector('lr-cloud-editor')?.addEventListener('apply', (e) => {
    console.log(e);
  });
});
