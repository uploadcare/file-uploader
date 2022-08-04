import { ifRef } from '../../utils/ifRef.js';
import { UrlSource } from './UrlSource.js';
import { registerBlocks } from '../../abstract/registerBlocks.js';

ifRef(() => {
  registerBlocks({ UrlSource });
  /** @type {UrlSource} */
  let urlSource = document.querySelector(UrlSource.is);
  urlSource.$['*currentActivity'] = 'url';
});
