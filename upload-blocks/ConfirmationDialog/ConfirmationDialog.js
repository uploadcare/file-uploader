import { BlockComponent } from '../BlockComponent/BlockComponent.js';

export class ConfirmationDialog extends BlockComponent {
  init$ = {
    onNo: () => {
      this.historyBack();
    },
    onYes: () => {
      this.$['*confirmationAction']?.();
    },
    '*confirmationAction': () => {
      console.log('CONFIRMATION');
    },
  };
}

ConfirmationDialog.template = /*html*/ `
<div .txt l10n="are-you-sure"></div>
<div .toolbar>
  <button .no-btn set="onclick: onNo" l10n="no"></button>
  <button .yes-btn set="onclick: onYes" l10n="yes"></button>
</div>
`;
