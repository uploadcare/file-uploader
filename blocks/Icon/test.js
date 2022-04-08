import { Icon } from './Icon.js';
import { registerBlocks } from '../registerBlocks.js';

registerBlocks({ Icon });

const icon = new Icon();
icon.classList.add('uc-wgt-common');

window.onload = () => {
  document.querySelector('#viewport')?.appendChild(icon);
  icon.setAttribute('name', 'file');
};
