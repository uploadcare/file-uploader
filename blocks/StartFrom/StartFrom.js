import { ActivityBlock } from '../../abstract/ActivityBlock.js';

export class StartFrom extends ActivityBlock {
  activityType = 'start-from';

  initCallback() {
    super.initCallback();
    this.registerActivity(this.activityType, () => {
      this.add$(
        {
          '*activityCaption': this.l10n('select-file-source'),
          '*activityIcon': 'default',
        },
        true
      );
    });
  }
}
