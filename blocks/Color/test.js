import { ifRef } from '../../utils/ifRef.js';
import { Color } from './Color.js';
import { registerBlocks } from '../../abstract/registerBlocks.js';

ifRef(() => {
  registerBlocks({ Color });
  /** @type {Color} */
  let colorInput = document.querySelector(Color.is);
  colorInput.$['*selectedColor'] = 'blue';
});
