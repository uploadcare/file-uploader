import { BaseComponent } from '../../symbiote/core/BaseComponent.js';

export class ConfirmationDialog extends BaseComponent {
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

  readyCallback() {
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