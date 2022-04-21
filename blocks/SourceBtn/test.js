import { SourceBtn } from './SourceBtn.js';
import { Icon } from '../Icon/Icon.js';
import { registerBlocks } from '../../abstract/registerBlocks.js';

registerBlocks({ SourceBtn, Icon });

const sourceBtn = new SourceBtn();
sourceBtn.classList.add('uc-wgt-common');

window.onload = () => {
  document.querySelector('#viewport')?.appendChild(sourceBtn);
  sourceBtn['type'] = 'camera';
};
