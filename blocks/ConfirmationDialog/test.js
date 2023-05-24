import { ifRef } from '../../utils/ifRef.js';
import { ConfirmationDialog, UiConfirmation } from './ConfirmationDialog.js';
import { registerBlocks } from '../../abstract/registerBlocks.js';

ifRef(() => {
  registerBlocks({ ConfirmationDialog });
  /** @type {ConfirmationDialog} */
  let confirmDialog = document.querySelector(ConfirmationDialog.is);
  confirmDialog.$['*confirmation'] = new UiConfirmation();
});
