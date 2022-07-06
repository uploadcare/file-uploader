import { EditableCanvas } from './EditableCanvas.js';
import { registerBlocks } from '../../abstract/registerBlocks.js';

window.onload = () => {
  if (window.location.host) {
    return;
  }
  registerBlocks({ EditableCanvas });
  const editableCanvas = new EditableCanvas();
  editableCanvas.classList.add('lr-wgt-common');
  document.querySelector('#viewport')?.appendChild(editableCanvas);
  let img = new Image();
  img.src = '../../assets/media/kitten.jpg';
  editableCanvas.setImage(img);
};
