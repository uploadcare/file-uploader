import { ifRef } from '../../utils/ifRef.js';
import { Modal } from './Modal.js';
import { Icon } from '../Icon/Icon.js';
import { registerBlocks } from '../../abstract/registerBlocks.js';

ifRef(() => {
  registerBlocks({ Modal, Icon });
  /** @type {Modal} */
  let modal = document.querySelector(Modal.is);
  document.querySelector('button').onclick = () => {
    modal.$['*modalActive'] = true;
  };
  modal.$['*modalActive'] = true;
});
