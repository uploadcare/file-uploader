import { BlockComponent } from '../BlockComponent/BlockComponent.js';

export class ConfirmationDialog extends BlockComponent {
  init$ = {
    'on.no': () => {
      this.historyBack();
    },
    'on.yes': () => {
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
  <button .no-btn set="onclick: on.no" l10n="no"></button>
  <button .yes-btn set="onclick: on.yes" l10n="yes"></button>
</div>
`;
