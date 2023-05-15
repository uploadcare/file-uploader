import { ActivityBlock } from '../../abstract/ActivityBlock.js';

export class UiConfirmation {
  captionL10nStr = 'confirm-your-action';
  messageL10Str = 'are-you-sure';
  confirmL10nStr = 'yes';
  denyL10nStr = 'no';
  confirmAction() {
    console.log('Confirmed');
  }
  denyAction() {
    this['historyBack']();
  }
}

export class ConfirmationDialog extends ActivityBlock {
  activityType = ActivityBlock.activities.CONFIRMATION;

  /** @private */
  _defaults = new UiConfirmation();

  init$ = {
    ...this.init$,
    activityCaption: '',
    messageTxt: '',
    confirmBtnTxt: '',
    denyBtnTxt: '',
    '*confirmation': null,
    onConfirm: this._defaults.confirmAction,
    onDeny: this._defaults.denyAction.bind(this),
  };

  initCallback() {
    super.initCallback();
    this.set$({
      messageTxt: this.l10n(this._defaults.messageL10Str),
      confirmBtnTxt: this.l10n(this._defaults.confirmL10nStr),
      denyBtnTxt: this.l10n(this._defaults.denyL10nStr),
    });
    this.sub('*confirmation', (/** @type {UiConfirmation} */ cfn) => {
      if (!cfn) {
        return;
      }
      this.set$({
        '*currentActivity': ActivityBlock.activities.CONFIRMATION,
        activityCaption: this.l10n(cfn.captionL10nStr),
        messageTxt: this.l10n(cfn.messageL10Str),
        confirmBtnTxt: this.l10n(cfn.confirmL10nStr),
        denyBtnTxt: this.l10n(cfn.denyL10nStr),
        onDeny: () => {
          cfn.denyAction();
        },
        onConfirm: () => {
          cfn.confirmAction();
        },
      });
    });
  }
}

ConfirmationDialog.template = /* HTML */ `
  <lr-activity-header>
    <button type="button" class="mini-btn" set="onclick: *historyBack">
      <lr-icon name="back"></lr-icon>
    </button>
    <span>{{activityCaption}}</span>
    <button type="button" class="mini-btn close-btn" set="onclick: *closeModal">
      <lr-icon name="close"></lr-icon>
    </button>
  </lr-activity-header>

  <div class="message">{{messageTxt}}</div>
  <div class="toolbar">
    <button type="button" class="deny-btn secondary-btn" set="onclick: onDeny">{{denyBtnTxt}}</button>
    <button type="button" class="confirm-btn primary-btn" set="onclick: onConfirm">{{confirmBtnTxt}}</button>
  </div>
`;
