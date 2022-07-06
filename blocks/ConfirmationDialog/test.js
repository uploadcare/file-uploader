import { ConfirmationDialog, UiConfirmation } from './ConfirmationDialog.js';
import { registerBlocks } from '../../abstract/registerBlocks.js';

registerBlocks({ ConfirmationDialog });

const confirmDialog = new ConfirmationDialog();
confirmDialog.classList.add('lr-wgt-common');

window.onload = () => {
  document.querySelector('#viewport')?.appendChild(confirmDialog);
  confirmDialog.$['*confirmation'] = new UiConfirmation();
};
