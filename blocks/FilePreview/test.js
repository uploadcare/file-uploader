import { ifRef } from '../../utils/ifRef.js';
import { FilePreview } from './FilePreview.js';
import { registerBlocks } from '../../abstract/registerBlocks.js';

ifRef(() => {
  registerBlocks({ FilePreview });
  /** @type {FilePreview} */
  const filePreview = document.querySelector(FilePreview.is);
  let img = new Image();
  img.src = '../../assets/media/kitten.jpg';
  filePreview.setImage(img);
});
