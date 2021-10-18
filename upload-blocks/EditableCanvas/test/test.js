import { EditableCanvas } from '../EditableCanvas.js';
import { Icon } from '../../Icon/Icon.js';

EditableCanvas.reg('editable-canvas');
Icon.reg('uc-icon');

window.onload = () => {
  /** @type {EditableCanvas} */
  let edtr = document.querySelector(EditableCanvas.is);
  let img = new Image();
  img.src = 'test.jpg';
  edtr.setImage(img);
  window.setTimeout(() => {
    edtr.setAttribute('active', '');
  }, 100);
};
