import { BlockComponent } from '../BlockComponent/BlockComponent.js';

export class ConfirmationDialog extends BlockComponent {
  constructor() {
    super();
    this.initLocalState({
      'on.no': () => {
        this.historyBack();
      },
      'on.yes': () => {
        this.read('external', 'confirmationAction')?.();
      },
    });
  }

  initCallback() {
    this.addToExternalState({
      confirmationAction: () => {
        console.log('CONFIRMATION');
      },
    });
  }
}

ConfirmationDialog.template = /*html*/ `
<div .txt l10n="are-you-sure"></div>
<div .toolbar>
  <button .no-btn loc="onclick: on.no" l10n="no"></button>
  <button .yes-btn loc="onclick: on.yes" l10n="yes"></button>
</div>
`;