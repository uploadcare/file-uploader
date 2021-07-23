import { AppComponent } from '../AppComponent/AppComponent.js';

export class ConfirmationDialog extends AppComponent {
  constructor() {
    super();
    this.initLocalState({
      'on.no': () => {
        this.appState.pub('backTrigger', {});
      },
      'on.yes': () => {
        this.appState.read('confirmationAction')?.();
      },
    });
  }

  connectedCallback() {
    super.connectedCallback();
    this.addToAppState({
      confirmationAction: () => {
        console.log('CONFIRMATION');
      },
    });
  }
}

ConfirmationDialog.template = /*html*/ `
<div -txt->Are you sure?</div>
<div -toolbar->
  <button -no-btn- sub="onclick: on.no">No</button>
  <button -yes-btn- sub="onclick: on.yes">Yes</button>
</div>
`;