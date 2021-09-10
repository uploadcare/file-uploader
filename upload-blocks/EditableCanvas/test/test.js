import { EditableCanvas } from '../EditableCanvas.js';
import { IconUi } from '../../IconUi/IconUi.js';

EditableCanvas.reg('editable-canvas');
IconUi.reg('uc-icon-ui');

window.onload = () => {
  /** @type {EditableCanvas} */
  let edtr = document.querySelector(EditableCanvas.is);
  let img = new Image();
  img.src = 'test.jpg';
  edtr.setImage(img);
};
