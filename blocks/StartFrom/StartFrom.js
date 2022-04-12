import { Block } from '../../abstract/Block.js';

export class StartFrom extends Block {
  activityType = 'start-from';

  init$ = {
    '*activityCaption': '',
    '*activityIcon': '',
  };

  initCallback() {
    super.initCallback();
    this.registerActivity(this.activityType, () => {
      this.set$({
        '*activityCaption': this.l10n('select-file-source'),
        '*activityIcon': 'default',
      });
    });
  }
}
