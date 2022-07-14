import { ifRef } from '../../utils/ifRef.js';
import { EditableCanvas } from './EditableCanvas.js';
import { registerBlocks } from '../../abstract/registerBlocks.js';

ifRef(() => {
  registerBlocks({ EditableCanvas });
  /** @type {EditableCanvas} */
  const editableCanvas = document.querySelector(EditableCanvas.is);
  let img = new Image();
  img.src = '../../assets/media/kitten.jpg';
  editableCanvas.setImage(img);
});
