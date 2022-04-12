import { DropArea } from './DropArea.js';
import { registerBlocks } from '../registerBlocks.js';

registerBlocks({ DropArea });

const dropArea = new DropArea();
dropArea.classList.add('uc-wgt-common');

window.onload = () => {
  document.querySelector('#viewport')?.appendChild(dropArea);
};
