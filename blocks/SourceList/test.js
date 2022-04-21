import { SourceList } from './SourceList.js';
import { SourceBtn } from '../SourceBtn/SourceBtn.js';
import { Icon } from '../Icon/Icon.js';
import { registerBlocks } from '../../abstract/registerBlocks.js';

registerBlocks({ SourceList, SourceBtn, Icon });

const sourceList = new SourceList();
sourceList.classList.add('uc-wgt-common');

window.onload = () => {
  document.querySelector('#viewport')?.appendChild(sourceList);
};
