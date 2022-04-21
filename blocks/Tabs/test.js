import { Tabs } from './Tabs.js';
import { registerBlocks } from '../../abstract/registerBlocks.js';

registerBlocks({ Tabs });

const tabs = new Tabs();
tabs.classList.add('uc-wgt-common');

window.onload = () => {
  document.querySelector('#viewport')?.appendChild(tabs);
  tabs.setAttribute('tab-list', 'First Tab, Second Tab');
  tabs.setAttribute('default', 'First Tab');
};
