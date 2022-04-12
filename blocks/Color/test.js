import { Color } from './Color.js';
import { registerBlocks } from '../registerBlocks.js';

registerBlocks({ Color });

const colorInput = new Color();
colorInput.classList.add('uc-wgt-common');

window.onload = () => {
  document.querySelector('#viewport')?.appendChild(colorInput);
  colorInput.$['*selectedColor'] = 'blue';
};
