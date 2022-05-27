import { UrlSource } from './UrlSource.js';
import { registerBlocks } from '../../abstract/registerBlocks.js';

registerBlocks({ UrlSource });

const urlSource = new UrlSource();
urlSource.classList.add('lr-wgt-common');

window.onload = () => {
  document.querySelector('#viewport')?.appendChild(urlSource);
  urlSource.$['*currentActivity'] = 'url';
};
