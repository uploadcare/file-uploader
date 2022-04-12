import * as blocks from '../index.js';

blocks.registerBlocks(blocks);

window.addEventListener('DOMContentLoaded', () => {
  document.querySelector('uc-cloud-editor')?.addEventListener('apply', (e) => {
    console.log(e);
  });
});
