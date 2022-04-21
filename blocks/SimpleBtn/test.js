import { SimpleBtn } from './SimpleBtn.js';
import { Icon } from '../Icon/Icon.js';
import { registerBlocks } from '../../abstract/registerBlocks.js';

registerBlocks({ SimpleBtn, Icon });

const simpleBtn = new SimpleBtn();
simpleBtn.classList.add('uc-wgt-common');

window.onload = () => {
  document.querySelector('#viewport')?.appendChild(simpleBtn);
};
