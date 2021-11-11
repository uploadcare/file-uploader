import { BlockComponent } from '../BlockComponent/BlockComponent.js';

export class UiConfirmation {
  captionL10nStr = 'confirm-your-action';
  messsageL10Str = 'are-you-sure';
  confirmL10nStr = 'yes';
  denyL10nStr = 'no';
  confirmAction() {
    console.log('Confirmed');
  }
  denyAction() {
    this['historyBack']();
  }
}

export class ConfirmationDialog extends BlockComponent {
  activityType = BlockComponent.activities.CONFIRMATION;

  _defaults = new UiConfirmation();

  init$ = {
    messageTxt: this.l10n(this._defaults.messsageL10Str),
    confirmBtnTxt: this.l10n(this._defaults.confirmL10nStr),
    denyBtnTxt: this.l10n(this._defaults.denyL10nStr),
    '*confirmation': null,
    onConfirm: this._defaults.confirmAction,
    onDeny: this._defaults.denyAction.bind(this),
  };

  initCallback() {
    this.sub('*confirmation', (/** @type {UiConfirmation} */ cfn) => {
      if (!cfn) {
        return;
      }
      this.set$({
        '*modalHeaderHidden': true,
        '*currentActivity': BlockComponent.activities.CONFIRMATION,
        '*modalCaption': this.l10n(cfn.captionL10nStr),
        messageTxt: this.l10n(cfn.messsageL10Str),
        confirmBtnTxt: this.l10n(cfn.confirmL10nStr),
        denyBtnTxt: this.l10n(cfn.denyL10nStr),
        onDeny: () => {
          this.$['*modalHeaderHidden'] = false;
          cfn.denyAction();
        },
        onConfirm: () => {
          this.$['*modalHeaderHidden'] = false;
          cfn.confirmAction();
        },
      });
    });
  }
}

ConfirmationDialog.template = /*html*/ `
<div 
  .message 
  set="textContent: messageTxt">
</div>
<div .toolbar>
  <button 
    .deny-btn 
    .secondary-btn
    set="textContent: denyBtnTxt; onclick: onDeny">
  </button>
  <button 
    .confirm-btn 
    .primary-btn
    set="textContent: confirmBtnTxt; onclick: onConfirm">
  </button>
</div>
`;
