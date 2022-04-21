import { EditableCanvas } from './EditableCanvas.js';
import { registerBlocks } from '../../abstract/registerBlocks.js';

registerBlocks({ EditableCanvas });

const editableCanvas = new EditableCanvas();
editableCanvas.classList.add('uc-wgt-common');

window.onload = () => {
  document.querySelector('#viewport')?.appendChild(editableCanvas);
  let img = new Image();
  img.src = '../../assets/media/kitten.jpg';
  editableCanvas.setImage(img);
};
