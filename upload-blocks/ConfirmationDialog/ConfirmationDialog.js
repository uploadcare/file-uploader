import { BlockComponent } from '../BlockComponent/BlockComponent.js';

export class ConfirmationDialog extends BlockComponent {
  constructor() {
    super();
    this.initLocalState({
      'on.no': () => {
        this.externalState.pub('backTrigger', {});
      },
      'on.yes': () => {
        this.externalState.read('confirmationAction')?.();
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
<div -txt->Are you sure?</div>
<div -toolbar->
  <button -no-btn- loc="onclick: on.no">No</button>
  <button -yes-btn- loc="onclick: on.yes">Yes</button>
</div>
`;