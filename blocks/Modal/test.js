import { Modal } from './Modal.js';
import { Icon } from '../Icon/Icon.js';
import { registerBlocks } from '../../abstract/registerBlocks.js';

registerBlocks({ Modal, Icon });

const modal = new Modal();
modal.classList.add('lr-wgt-common');
window.onload = () => {
  if (window.location.host) {
    return;
  }
  document.querySelector('button').onclick = () => {
    modal.$['*modalActive'] = true;
  };
  modal.innerHTML = /*html*/ `
    <lr-icon slot="heading" name="default"></lr-icon>
    <div slot="heading">Modal Heading</div>
    <div style="padding: 20px">Some content</div>
  `;
  document.querySelector('#viewport').appendChild(modal);
  modal.$['*modalActive'] = true;
};
