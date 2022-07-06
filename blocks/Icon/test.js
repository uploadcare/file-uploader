import { Icon } from './Icon.js';
import { registerBlocks } from '../../abstract/registerBlocks.js';

registerBlocks({ Icon });

const icon = new Icon();
icon.classList.add('lr-wgt-common');

window.onload = () => {
  document.querySelector('#viewport')?.appendChild(icon);
  icon.setAttribute('name', 'file');
};
