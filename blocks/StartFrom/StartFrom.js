import { ActivityBlock } from '../../abstract/ActivityBlock.js';

export class StartFrom extends ActivityBlock {
  activityType = 'start-from';

  initCallback() {
    super.initCallback();
    this.registerActivity(this.activityType, {
      onActivate: () => {
        this.add$(
          {
            '*activityCaption': this.l10n('select-file-source'),
            '*activityIcon': null,
          },
          true
        );
      },
    });
  }
}
