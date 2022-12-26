import { ActivityBlock } from '../../abstract/ActivityBlock.js';

export class StartFrom extends ActivityBlock {
  historyTracked = true;
  activityType = 'start-from';

  initCallback() {
    super.initCallback();
    this.registerActivity(this.activityType, {
      onActivate: () => {
        this.add$(
          {
            '*activityCaption': this.l10n('select-file-source'),
            '*activityIcon': '',
            '*modalHeaderHidden': true,
          },
          true
        );
      },
    });
  }
}
